package com.iwr.pdv.cash.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iwr.pdv.auth.api.dto.LoginRequest;
import com.iwr.pdv.auth.application.AuthService;
import com.iwr.pdv.cash.domain.CashMovementRepository;
import com.iwr.pdv.cash.domain.CashRegisterRepository;
import com.iwr.pdv.product.domain.Product;
import com.iwr.pdv.product.domain.ProductRepository;
import com.iwr.pdv.sale.domain.SaleRepository;
import com.iwr.pdv.sale.domain.StockMovementRepository;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
class CashRegisterControllerIntegrationTest {

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private AuthService authService;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private SaleRepository saleRepository;

    @Autowired
    private StockMovementRepository stockMovementRepository;

    @Autowired
    private CashMovementRepository cashMovementRepository;

    @Autowired
    private CashRegisterRepository cashRegisterRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();


    private MockMvc mockMvc;
    private String authHeader;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
        authHeader = "Bearer " + authService.login(new LoginRequest("admin", "admin123")).token();
        stockMovementRepository.deleteAll();
        saleRepository.deleteAll();
        cashMovementRepository.deleteAll();
        cashRegisterRepository.deleteAll();
        productRepository.deleteAll();
    }

    @Test
    void shouldOpenMoveAndCloseCashRegister() throws Exception {
        String openJson = mockMvc.perform(post("/api/cash-register/open")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"openingAmount\":100.00}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("OPEN"))
                .andExpect(jsonPath("$.openingAmount").value(100.00))
                .andReturn()
                .getResponse()
                .getContentAsString();
        Long cashRegisterId = objectMapper.readTree(openJson).path("id").asLong();

        mockMvc.perform(post("/api/cash-register/open")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"openingAmount\":50.00}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.message").value("There is already an open cash register."));

        mockMvc.perform(post("/api/cash-register/movements")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"CASH_IN\",\"amount\":20.00,\"reason\":\"Troco extra\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cashInAmount").value(20.00));

        mockMvc.perform(post("/api/cash-register/movements")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"CASH_OUT\",\"amount\":10.00,\"reason\":\"Sangria\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cashOutAmount").value(10.00));

        Product product = productRepository.save(buildProduct("Vestido Caixa", "IWR-CASH", new BigDecimal("50.00"), 3, true));
        String salePayload = """
                {
                  "items": [
                    {
                      "productId": %d,
                      "quantity": 1
                    }
                  ],
                  "paymentMethod": "CASH",
                  "discountAmount": 0,
                  "amountReceived": 60.00
                }
                """.formatted(product.getId());

        mockMvc.perform(post("/api/sales")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(salePayload))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/cash-register/current")
                        .header("Authorization", authHeader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cashSalesAmount").value(50.00))
                .andExpect(jsonPath("$.expectedCashAmount").value(160.00));

        mockMvc.perform(post("/api/cash-register/{cashRegisterId}/close", cashRegisterId)
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"declaredCashAmount\":155.00}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CLOSED"))
                .andExpect(jsonPath("$.expectedCashAmount").value(160.00))
                .andExpect(jsonPath("$.cashDifference").value(-5.00));
    }

    @Test
    void shouldReturnNoContentWhenThereIsNoCurrentCashRegister() throws Exception {
        mockMvc.perform(get("/api/cash-register/current")
                        .header("Authorization", authHeader))
                .andExpect(status().isNoContent());
    }

    private Product buildProduct(
            String name,
            String code,
            BigDecimal price,
            int stockQuantity,
            boolean active
    ) {
        Product product = new Product();
        product.setName(name);
        product.setCode(code);
        product.setPrice(price);
        product.setStockQuantity(stockQuantity);
        product.setActive(active);
        product.setCreatedAt(OffsetDateTime.now());
        product.setUpdatedAt(OffsetDateTime.now());

        return product;
    }
}
