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
import com.iwr.pdv.product.domain.ProductCategory;
import com.iwr.pdv.product.domain.ProductCategoryRepository;
import com.iwr.pdv.product.domain.ProductRepository;
import com.iwr.pdv.sale.domain.SaleRepository;
import com.iwr.pdv.sale.domain.StockMovementRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
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
    private ProductCategoryRepository categoryRepository;

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
                .andExpect(jsonPath("$.expectedCashAmount").value(160.00))
                .andExpect(jsonPath("$.sales.length()").value(1))
                .andExpect(jsonPath("$.sales[0].paymentMethod").value("CASH"))
                .andExpect(jsonPath("$.sales[0].totalAmount").value(50.00));

        mockMvc.perform(post("/api/cash-register/{cashRegisterId}/close", cashRegisterId)
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"declaredCashAmount\":155.00,\"closingDifferenceReason\":\"Falta conferida no fechamento\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CLOSED"))
                .andExpect(jsonPath("$.expectedCashAmount").value(160.00))
                .andExpect(jsonPath("$.cashDifference").value(-5.00))
                .andExpect(jsonPath("$.closingDifferenceReason").value("Falta conferida no fechamento"))
                .andExpect(jsonPath("$.sales.length()").value(1));
    }

    @Test
    void shouldRequireDifferenceReasonAndAllowAdminHistoryReportAndReopen() throws Exception {
        String openJson = mockMvc.perform(post("/api/cash-register/open")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"openingAmount\":80.00}"))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        Long cashRegisterId = objectMapper.readTree(openJson).path("id").asLong();
        Long operatorId = objectMapper.readTree(openJson).path("openedBy").path("id").asLong();

        mockMvc.perform(post("/api/cash-register/{cashRegisterId}/close", cashRegisterId)
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"declaredCashAmount\":75.00}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.message").value("Closing difference reason is required when cash difference is not zero."));

        mockMvc.perform(post("/api/cash-register/{cashRegisterId}/close", cashRegisterId)
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"declaredCashAmount\":75.00,\"closingDifferenceReason\":\"Divergencia conferida\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CLOSED"))
                .andExpect(jsonPath("$.closingDifferenceReason").value("Divergencia conferida"));

        mockMvc.perform(get("/api/cash-register")
                        .header("Authorization", authHeader)
                        .param("closedStartDate", LocalDate.now().toString())
                        .param("closedEndDate", LocalDate.now().toString())
                        .param("status", "CLOSED")
                        .param("operatorId", String.valueOf(operatorId))
                        .param("withDifference", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(cashRegisterId));

        mockMvc.perform(get("/api/cash-register/{cashRegisterId}/report", cashRegisterId)
                        .header("Authorization", authHeader))
                .andExpect(status().isOk());

        String operatorAuthHeader = createOperatorAuthHeader("operador_caixa_" + cashRegisterId);

        mockMvc.perform(get("/api/cash-register")
                        .header("Authorization", operatorAuthHeader))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/cash-register/{cashRegisterId}", cashRegisterId)
                        .header("Authorization", operatorAuthHeader))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/cash-register/{cashRegisterId}/report", cashRegisterId)
                        .header("Authorization", operatorAuthHeader))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/cash-register/{cashRegisterId}/reopen", cashRegisterId)
                        .header("Authorization", operatorAuthHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Tentativa sem permissao\"}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/cash-register/{cashRegisterId}/reopen", cashRegisterId)
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Corrigir conferencia\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OPEN"))
                .andExpect(jsonPath("$.reopenReason").value("Corrigir conferencia"));
    }

    @Test
    void shouldReturnNoContentWhenThereIsNoCurrentCashRegister() throws Exception {
        mockMvc.perform(get("/api/cash-register/current")
                        .header("Authorization", authHeader))
                .andExpect(status().isNoContent());
    }

    private String createOperatorAuthHeader(String username) throws Exception {
        mockMvc.perform(post("/api/users")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "username": "%s",
                                  "displayName": "Operador Caixa",
                                  "password": "senha123",
                                  "role": "OPERATOR",
                                  "active": true
                                }
                                """.formatted(username)))
                .andExpect(status().isCreated());

        return "Bearer " + authService.login(new LoginRequest(username, "senha123")).token();
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
        product.setCategory(category());
        product.setPrice(price);
        product.setStockQuantity(stockQuantity);
        product.setActive(active);
        product.setCreatedAt(OffsetDateTime.now());
        product.setUpdatedAt(OffsetDateTime.now());

        return product;
    }

    private ProductCategory category() {
        return categoryRepository.findByActiveTrueOrderByNameAsc()
                .stream()
                .findFirst()
                .orElseGet(() -> {
                    ProductCategory category = new ProductCategory();
                    category.setName("Vestidos");
                    category.setIcon("dress");
                    category.setActive(true);
                    category.setCreatedAt(OffsetDateTime.now());
                    category.setUpdatedAt(OffsetDateTime.now());
                    return categoryRepository.save(category);
                });
    }
}
