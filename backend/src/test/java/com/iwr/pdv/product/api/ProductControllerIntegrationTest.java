package com.iwr.pdv.product.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.iwr.pdv.product.domain.Product;
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
    private ProductCodeControlRepository productCodeControlRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
        productRepository.deleteAll();
        resetProductCodeSequence();
    }

    @Test
    void shouldCreateProductAndReturnItInListing() throws Exception {
        String payload = """
                {
                  "name": "Vestido Midi",
                  "code": "IWR-001",
                  "price": 149.90,
                  "stockQuantity": 8,
                  "active": true
                }
                """;

        mockMvc.perform(post("/api/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Vestido Midi"))
                .andExpect(jsonPath("$.code").value("IWR-001"))
                .andExpect(jsonPath("$.stockQuantity").value(8))
                .andExpect(jsonPath("$.active").value(true));

        mockMvc.perform(get("/api/products"))
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
                  "price": 0,
                  "stockQuantity": -1,
                  "active": true
                }
                """;

        mockMvc.perform(post("/api/products")
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
                  "price": 89.90,
                  "stockQuantity": 15,
                  "active": true
                }
                """;

        mockMvc.perform(put("/api/products/{productId}", savedProduct.getId())
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

        mockMvc.perform(get("/api/products").param("search", "vest"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].code").value("IWR-011"));

        mockMvc.perform(get("/api/products").param("search", "010"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Saia Jeans"));
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
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(disablePayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        mockMvc.perform(patch("/api/products/{productId}/activation", savedProduct.getId())
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
                  "price": 149.90,
                  "stockQuantity": 10,
                  "active": true
                }
                """;

        mockMvc.perform(post("/api/products")
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
                  "price": 189.90,
                  "stockQuantity": 6,
                  "active": true
                }
                """;

        mockMvc.perform(post("/api/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value("IWR-000001"));

        mockMvc.perform(post("/api/products")
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

        mockMvc.perform(get("/api/products/{productId}/qr-code", savedProduct.getId()))
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

        mockMvc.perform(get("/api/products/{productId}/label", savedProduct.getId()))
                .andExpect(status().isOk())
                .andExpect(result -> {
                    String html = result.getResponse().getContentAsString();
                    if (!html.contains("IWR MODAS")
                            || !html.contains("Vestido Festa")
                            || !html.contains("IWR-050")
                            || !html.contains("data:image/png;base64,")) {
                        throw new AssertionError("Expected a printable label HTML response.");
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
        product.setPrice(price);
        product.setStockQuantity(stockQuantity);
        product.setActive(active);
        product.setCreatedAt(OffsetDateTime.now());
        product.setUpdatedAt(OffsetDateTime.now());

        return product;
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
