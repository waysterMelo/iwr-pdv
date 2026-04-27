package com.iwr.pdv.sale.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
    private ProductCategoryRepository categoryRepository;

    @Autowired
    private SaleRepository saleRepository;

    @Autowired
    private StockMovementRepository stockMovementRepository;

    @Autowired
    private CashMovementRepository cashMovementRepository;

    @Autowired
    private CashRegisterRepository cashRegisterRepository;

    @Autowired
    private AuthService authService;

    private MockMvc mockMvc;
    private String authHeader;

    @BeforeEach
    void setUp() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
        authHeader = "Bearer " + authService.login(new LoginRequest("admin", "admin123")).token();
        stockMovementRepository.deleteAll();
        saleRepository.deleteAll();
        cashMovementRepository.deleteAll();
        cashRegisterRepository.deleteAll();
        productRepository.deleteAll();
        openCashRegister();
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
                  ],
                  "paymentMethod": "CASH",
                  "discountAmount": 10.00,
                  "amountReceived": 300.00
                }
                """.formatted(product.getId());

        mockMvc.perform(post("/api/sales")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.subtotalAmount").value(299.80))
                .andExpect(jsonPath("$.discountAmount").value(10.00))
                .andExpect(jsonPath("$.totalAmount").value(289.80))
                .andExpect(jsonPath("$.changeAmount").value(10.20))
                .andExpect(jsonPath("$.paymentMethod").value("CASH"))
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.operator.username").value("admin"))
                .andExpect(jsonPath("$.totalItems").value(2))
                .andExpect(jsonPath("$.items[0].productCode").value("IWR-100"))
                .andExpect(jsonPath("$.items[0].quantity").value(2));

        Product updatedProduct = productRepository.findById(product.getId()).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals(6, updatedProduct.getStockQuantity());
        org.junit.jupiter.api.Assertions.assertEquals(1, stockMovementRepository.count());
    }

    @Test
    void shouldSimulateMobilePdvSaleFlowWithoutPrintingOrQrCamera() throws Exception {
        String productPayload = """
                {
                  "name": "Produto Mobile Real",
                  "code": "IWR-MOBILE-001",
                  "categoryId": %d,
                  "price": 55.00,
                  "stockQuantity": 3,
                  "active": true
                }
                """.formatted(categoryId());

        mockMvc.perform(post("/api/products")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(productPayload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value("IWR-MOBILE-001"))
                .andExpect(jsonPath("$.stockQuantity").value(3));

        Product product = productRepository.findAll().stream()
                .filter(item -> "IWR-MOBILE-001".equals(item.getCode()))
                .findFirst()
                .orElseThrow();

        mockMvc.perform(get("/api/sales/product-by-code")
                        .header("Authorization", authHeader)
                        .param("code", "IWR-MOBILE-001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(product.getId()))
                .andExpect(jsonPath("$.active").value(true));

        String salePayload = """
                {
                  "items": [
                    {
                      "productId": %d,
                      "quantity": 1
                    },
                    {
                      "productId": %d,
                      "quantity": 1
                    }
                  ],
                  "paymentMethod": "PIX",
                  "discountAmount": 0
                }
                """.formatted(product.getId(), product.getId());

        mockMvc.perform(post("/api/sales")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(salePayload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.paymentMethod").value("PIX"))
                .andExpect(jsonPath("$.totalItems").value(2))
                .andExpect(jsonPath("$.totalAmount").value(110.00))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].quantity").value(2));

        Product updatedProduct = productRepository.findById(product.getId()).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals(1, updatedProduct.getStockQuantity());
        org.junit.jupiter.api.Assertions.assertEquals(1, saleRepository.count());
        org.junit.jupiter.api.Assertions.assertEquals(1, stockMovementRepository.count());

        mockMvc.perform(get("/api/sales")
                        .header("Authorization", authHeader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].items[0].productCode").value("IWR-MOBILE-001"));
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
                  ],
                  "paymentMethod": "PIX",
                  "discountAmount": 0
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
    void shouldRejectSaleWhenProductIsInactive() throws Exception {
        Product product = productRepository.save(buildProduct("Blusa Inativa", "IWR-101-INACTIVE", new BigDecimal("99.90"), 2, false));

        String payload = """
                {
                  "items": [
                    {
                      "productId": %d,
                      "quantity": 1
                    }
                  ],
                  "paymentMethod": "PIX",
                  "discountAmount": 0
                }
                """.formatted(product.getId());

        mockMvc.perform(post("/api/sales")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.message").value("Product 'IWR-101-INACTIVE' is inactive and cannot be sold."));

        Product unchangedProduct = productRepository.findById(product.getId()).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals(2, unchangedProduct.getStockQuantity());
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
                  ],
                  "paymentMethod": "DEBIT_CARD",
                  "discountAmount": 0
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
                .andExpect(jsonPath("$[0].paymentMethod").value("DEBIT_CARD"))
                .andExpect(jsonPath("$[0].items[0].productCode").value("IWR-102"));

        mockMvc.perform(get("/api/sales/{saleId}", saleId)
                        .header("Authorization", authHeader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(saleId))
                .andExpect(jsonPath("$.items[0].productName").value("Blusa Linho"));
    }

    @Test
    void shouldRejectSaleWithoutOpenCashRegister() throws Exception {
        cashMovementRepository.deleteAll();
        saleRepository.deleteAll();
        cashRegisterRepository.deleteAll();
        Product product = productRepository.save(buildProduct("Top Basico", "IWR-103", new BigDecimal("49.90"), 4, true));

        String payload = """
                {
                  "items": [
                    {
                      "productId": %d,
                      "quantity": 1
                    }
                  ],
                  "paymentMethod": "PIX",
                  "discountAmount": 0
                }
                """.formatted(product.getId());

        mockMvc.perform(post("/api/sales")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.message").value("Open the cash register before closing sales."));
    }

    @Test
    void shouldRejectCashPaymentWhenReceivedAmountIsInsufficient() throws Exception {
        Product product = productRepository.save(buildProduct("Cinto Couro", "IWR-104", new BigDecimal("80.00"), 2, true));

        String payload = """
                {
                  "items": [
                    {
                      "productId": %d,
                      "quantity": 1
                    }
                  ],
                  "paymentMethod": "CASH",
                  "discountAmount": 0,
                  "amountReceived": 70.00
                }
                """.formatted(product.getId());

        mockMvc.perform(post("/api/sales")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.message").value("Cash received amount must be greater than or equal to sale total."));
    }

    @Test
    void shouldRejectDiscountGreaterThanSubtotal() throws Exception {
        Product product = productRepository.save(buildProduct("Bolsa Pequena", "IWR-105", new BigDecimal("50.00"), 2, true));

        String payload = """
                {
                  "items": [
                    {
                      "productId": %d,
                      "quantity": 1
                    }
                  ],
                  "paymentMethod": "PIX",
                  "discountAmount": 60.00
                }
                """.formatted(product.getId());

        mockMvc.perform(post("/api/sales")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.message").value("Discount amount cannot be greater than sale subtotal."));
    }

    @Test
    void shouldCancelSaleAndRestoreStock() throws Exception {
        Product product = productRepository.save(buildProduct("Jaqueta Jeans", "IWR-106", new BigDecimal("200.00"), 5, true));

        String payload = """
                {
                  "items": [
                    {
                      "productId": %d,
                      "quantity": 2
                    }
                  ],
                  "paymentMethod": "CREDIT_CARD",
                  "discountAmount": 0
                }
                """.formatted(product.getId());

        String saleJson = mockMvc.perform(post("/api/sales")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        Long saleId = Long.valueOf(saleJson.replaceAll(".*\"id\":(\\d+).*", "$1"));

        mockMvc.perform(post("/api/sales/{saleId}/cancel", saleId)
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Cliente desistiu\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.cancellationReason").value("Cliente desistiu"));

        Product updatedProduct = productRepository.findById(product.getId()).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals(5, updatedProduct.getStockQuantity());
        org.junit.jupiter.api.Assertions.assertEquals(2, stockMovementRepository.count());

        mockMvc.perform(post("/api/sales/{saleId}/cancel", saleId)
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Duplicado\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.message").value("Sale is already cancelled."));
    }

    @Test
    void shouldGenerateSaleReceiptAsHtml() throws Exception {
        Product product = productRepository.save(buildProduct("Lenco Seda", "IWR-107", new BigDecimal("39.90"), 3, true));

        String payload = """
                {
                  "items": [
                    {
                      "productId": %d,
                      "quantity": 1
                    }
                  ],
                  "paymentMethod": "PIX",
                  "discountAmount": 0
                }
                """.formatted(product.getId());

        String saleJson = mockMvc.perform(post("/api/sales")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        Long saleId = Long.valueOf(saleJson.replaceAll(".*\"id\":(\\d+).*", "$1"));

        mockMvc.perform(get("/api/sales/{saleId}/receipt", saleId)
                        .header("Authorization", authHeader))
                .andExpect(status().isOk())
                .andExpect(result -> {
                    String html = result.getResponse().getContentAsString();
                    if (!html.contains("Recibo nao fiscal")
                            || !html.contains("Lenco Seda")
                            || !html.contains("PIX")
                            || !html.contains("Vendedor")
                            || !html.contains("Administrador")) {
                        throw new AssertionError("Expected a sale receipt HTML response.");
                    }
                });
    }

    private void openCashRegister() throws Exception {
        mockMvc.perform(post("/api/cash-register/open")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"openingAmount\":100.00}"))
                .andExpect(status().isCreated());
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

    private Long categoryId() {
        return category().getId();
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
