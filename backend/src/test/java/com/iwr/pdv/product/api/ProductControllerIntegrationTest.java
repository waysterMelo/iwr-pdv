package com.iwr.pdv.product.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.iwr.pdv.auth.api.dto.LoginRequest;
import com.iwr.pdv.auth.application.AuthService;
import com.iwr.pdv.product.domain.Product;
import com.iwr.pdv.product.domain.ProductCategory;
import com.iwr.pdv.product.domain.ProductCategoryRepository;
import com.iwr.pdv.product.domain.ProductCodeControl;
import com.iwr.pdv.product.domain.ProductCodeControlRepository;
import com.iwr.pdv.product.domain.ProductRepository;
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
class ProductControllerIntegrationTest {

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private ProductCategoryRepository categoryRepository;

    @Autowired
    private ProductCodeControlRepository productCodeControlRepository;

    @Autowired
    private AuthService authService;

    private MockMvc mockMvc;
    private String authHeader;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
        authHeader = "Bearer " + authService.login(new LoginRequest("admin", "admin123")).token();
        productRepository.deleteAll();
        resetProductCodeSequence();
    }

    @Test
    void shouldCreateProductAndReturnItInListing() throws Exception {
        String payload = """
                {
                  "name": "Vestido Midi",
                  "code": "IWR-001",
                  "categoryId": %d,
                  "price": 149.90,
                  "stockQuantity": 8,
                  "active": true
                }
                """.formatted(categoryId());

        mockMvc.perform(post("/api/products")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Vestido Midi"))
                .andExpect(jsonPath("$.code").value("IWR-001"))
                .andExpect(jsonPath("$.stockQuantity").value(8))
                .andExpect(jsonPath("$.active").value(true));

        mockMvc.perform(get("/api/products")
                        .header("Authorization", authHeader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Vestido Midi"))
                .andExpect(jsonPath("$[0].code").value("IWR-001"));
    }

    @Test
    void shouldRejectInvalidPayload() throws Exception {
        String payload = """
                {
                  "name": "",
                  "code": "IWR-002",
                  "categoryId": %d,
                  "price": 0,
                  "stockQuantity": -1,
                  "active": true
                }
                """.formatted(categoryId());

        mockMvc.perform(post("/api/products")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed for the request payload."))
                .andExpect(jsonPath("$.violations.length()").value(3));
    }

    @Test
    void shouldEditExistingProduct() throws Exception {
        Product savedProduct = productRepository.save(buildProduct(
                "Camisa Polo",
                "IWR-003",
                new BigDecimal("79.90"),
                12,
                true
        ));

        String payload = """
                {
                  "name": "Camisa Polo Premium",
                  "code": "IWR-003",
                  "categoryId": %d,
                  "price": 89.90,
                  "stockQuantity": 15,
                  "active": true
                }
                """.formatted(categoryId());

        mockMvc.perform(put("/api/products/{productId}", savedProduct.getId())
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Camisa Polo Premium"))
                .andExpect(jsonPath("$.price").value(89.90))
                .andExpect(jsonPath("$.stockQuantity").value(15));
    }

    @Test
    void shouldSearchProductsByNameOrCode() throws Exception {
        productRepository.save(buildProduct("Saia Jeans", "IWR-010", new BigDecimal("99.90"), 5, true));
        productRepository.save(buildProduct("Vestido Floral", "IWR-011", new BigDecimal("159.90"), 7, true));

        mockMvc.perform(get("/api/products")
                        .header("Authorization", authHeader)
                        .param("search", "vest"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].code").value("IWR-011"));

        mockMvc.perform(get("/api/products")
                        .header("Authorization", authHeader)
                        .param("search", "010"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Saia Jeans"));
    }

    @Test
    void shouldReturnPagedProductsWithInventoryFilters() throws Exception {
        productRepository.save(buildProduct("Vestido Amarelo", "IWR-101", new BigDecimal("80.00"), 3, true));
        productRepository.save(buildProduct("Vestido Azul", "IWR-102", new BigDecimal("120.00"), 10, true));
        productRepository.save(buildProduct("Vestido Inativo", "IWR-103", new BigDecimal("90.00"), 2, false));
        productRepository.save(buildProduct("Blusa Verde", "IWR-104", new BigDecimal("60.00"), 0, true));

        mockMvc.perform(get("/api/products/page")
                        .header("Authorization", authHeader)
                        .param("search", "vestido")
                        .param("active", "true")
                        .param("stockStatus", "LOW_STOCK")
                        .param("lowStockThreshold", "5")
                        .param("minPrice", "70")
                        .param("maxPrice", "100")
                        .param("page", "0")
                        .param("size", "2")
                        .param("sort", "name")
                        .param("direction", "asc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].code").value("IWR-101"))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(2))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.totalPages").value(1))
                .andExpect(jsonPath("$.first").value(true))
                .andExpect(jsonPath("$.last").value(true));
    }

    @Test
    void shouldActivateAndInactivateProduct() throws Exception {
        Product savedProduct = productRepository.save(buildProduct(
                "Blazer Feminino",
                "IWR-020",
                new BigDecimal("199.90"),
                4,
                true
        ));

        String disablePayload = """
                {
                  "active": false
                }
                """;
        String enablePayload = """
                {
                  "active": true
                }
                """;

        mockMvc.perform(patch("/api/products/{productId}/activation", savedProduct.getId())
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(disablePayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        mockMvc.perform(patch("/api/products/{productId}/activation", savedProduct.getId())
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(enablePayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true));
    }

    @Test
    void shouldRejectDuplicateProductCode() throws Exception {
        productRepository.save(buildProduct(
                "Calca Alfaiataria",
                "IWR-030",
                new BigDecimal("139.90"),
                9,
                true
        ));

        String payload = """
                {
                  "name": "Calca Alfaiataria Nova",
                  "code": "IWR-030",
                  "categoryId": %d,
                  "price": 149.90,
                  "stockQuantity": 10,
                  "active": true
                }
                """.formatted(categoryId());

        mockMvc.perform(post("/api/products")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("A product with code 'IWR-030' already exists."));
    }

    @Test
    void shouldGenerateCodeAutomaticallyWhenCodeIsBlank() throws Exception {
        String payload = """
                {
                  "name": "Macacao Linho",
                  "code": "",
                  "categoryId": %d,
                  "price": 189.90,
                  "stockQuantity": 6,
                  "active": true
                }
                """.formatted(categoryId());

        mockMvc.perform(post("/api/products")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value("IWR-000001"));

        mockMvc.perform(post("/api/products")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload.replace("Macacao Linho", "Macacao Linho Premium")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value("IWR-000002"));
    }

    @Test
    void shouldGenerateProductQrCodeAsPng() throws Exception {
        Product savedProduct = productRepository.save(buildProduct(
                "Casaco Tricot",
                "IWR-040",
                new BigDecimal("219.90"),
                3,
                true
        ));

        mockMvc.perform(get("/api/products/{productId}/qr-code", savedProduct.getId())
                        .header("Authorization", authHeader))
                .andExpect(status().isOk())
                .andExpect(result -> {
                    byte[] bytes = result.getResponse().getContentAsByteArray();
                    if (bytes.length < 4
                            || bytes[0] != (byte) 0x89
                            || bytes[1] != 0x50
                            || bytes[2] != 0x4E
                            || bytes[3] != 0x47) {
                        throw new AssertionError("Expected a PNG image response.");
                    }
                });
    }

    @Test
    void shouldGeneratePrintableProductLabelAsHtml() throws Exception {
        Product savedProduct = productRepository.save(buildProduct(
                "Vestido Festa",
                "IWR-050",
                new BigDecimal("259.90"),
                2,
                true
        ));

        mockMvc.perform(get("/api/products/{productId}/label", savedProduct.getId())
                        .header("Authorization", authHeader))
                .andExpect(status().isOk())
                .andExpect(result -> {
                    String html = result.getResponse().getContentAsString();
                    if (!html.contains("IWR MODAS")
                            || !html.contains("Vestido Festa")
                            || !html.contains("@page { size: 50mm 30mm; margin: 0; }")
                            || !html.contains("width: 18mm;")
                            || !html.contains("class=\"qr-frame\"")
                            || !html.contains("data:image/png;base64,")) {
                        throw new AssertionError("Expected a printable label HTML response.");
                    }
                    if (html.contains("IWR-050") || html.contains("class=\"code\"")) {
                        throw new AssertionError("Product code must not be visible in the printable label.");
                    }
                });
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

    private void resetProductCodeSequence() {
        ProductCodeControl control = productCodeControlRepository.findById(1L)
                .orElseGet(() -> {
                    ProductCodeControl newControl = new ProductCodeControl();
                    newControl.setId(1L);
                    return newControl;
                });
        control.setNextValue(1L);
        productCodeControlRepository.save(control);
    }
}
