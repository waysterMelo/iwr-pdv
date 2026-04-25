package com.iwr.pdv.sale.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.iwr.pdv.auth.api.dto.LoginRequest;
import com.iwr.pdv.auth.application.AuthService;
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
class SaleControllerIntegrationTest {

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private SaleRepository saleRepository;

    @Autowired
    private StockMovementRepository stockMovementRepository;

    @Autowired
    private AuthService authService;

    private MockMvc mockMvc;
    private String authHeader;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
        authHeader = "Bearer " + authService.login(new LoginRequest("admin", "admin123")).token();
        stockMovementRepository.deleteAll();
        saleRepository.deleteAll();
        productRepository.deleteAll();
    }

    @Test
    void shouldCloseSaleAndDecreaseStock() throws Exception {
        Product product = productRepository.save(buildProduct("Vestido Midi", "IWR-100", new BigDecimal("149.90"), 8, true));

        String payload = """
                {
                  "items": [
                    {
                      "productId": %d,
                      "quantity": 2
                    }
                  ]
                }
                """.formatted(product.getId());

        mockMvc.perform(post("/api/sales")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.totalAmount").value(299.80))
                .andExpect(jsonPath("$.totalItems").value(2))
                .andExpect(jsonPath("$.items[0].productCode").value("IWR-100"))
                .andExpect(jsonPath("$.items[0].quantity").value(2));

        Product updatedProduct = productRepository.findById(product.getId()).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals(6, updatedProduct.getStockQuantity());
        org.junit.jupiter.api.Assertions.assertEquals(1, stockMovementRepository.count());
    }

    @Test
    void shouldRejectSaleWhenStockIsInsufficient() throws Exception {
        Product product = productRepository.save(buildProduct("Saia Jeans", "IWR-101", new BigDecimal("99.90"), 1, true));

        String payload = """
                {
                  "items": [
                    {
                      "productId": %d,
                      "quantity": 2
                    }
                  ]
                }
                """.formatted(product.getId());

        mockMvc.perform(post("/api/sales")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.message").value("Product 'IWR-101' has insufficient stock. Available: 1."));

        Product unchangedProduct = productRepository.findById(product.getId()).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals(1, unchangedProduct.getStockQuantity());
        org.junit.jupiter.api.Assertions.assertEquals(0, stockMovementRepository.count());
    }

    @Test
    void shouldListSalesHistoryAndFindSaleDetails() throws Exception {
        Product product = productRepository.save(buildProduct("Blusa Linho", "IWR-102", new BigDecimal("89.90"), 4, true));

        String payload = """
                {
                  "items": [
                    {
                      "productId": %d,
                      "quantity": 1
                    }
                  ]
                }
                """.formatted(product.getId());

        String saleJson = mockMvc.perform(post("/api/sales")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andReturn()
                .getResponse()
                .getContentAsString();

        Long saleId = Long.valueOf(saleJson.replaceAll(".*\"id\":(\\d+).*", "$1"));

        mockMvc.perform(get("/api/sales")
                        .header("Authorization", authHeader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(saleId))
                .andExpect(jsonPath("$[0].items[0].productCode").value("IWR-102"));

        mockMvc.perform(get("/api/sales/{saleId}", saleId)
                        .header("Authorization", authHeader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(saleId))
                .andExpect(jsonPath("$.items[0].productName").value("Blusa Linho"));
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
