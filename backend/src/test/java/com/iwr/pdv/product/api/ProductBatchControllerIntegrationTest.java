package com.iwr.pdv.product.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.iwr.pdv.auth.api.dto.LoginRequest;
import com.iwr.pdv.auth.application.AuthService;
import com.iwr.pdv.auth.domain.AppUserRepository;
import com.iwr.pdv.auth.domain.AuthSessionRepository;
import com.iwr.pdv.product.domain.ProductBatchRepository;
import com.iwr.pdv.product.domain.ProductCategory;
import com.iwr.pdv.product.domain.ProductCategoryRepository;
import com.iwr.pdv.product.domain.ProductCodeControl;
import com.iwr.pdv.product.domain.ProductCodeControlRepository;
import com.iwr.pdv.product.domain.ProductRepository;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
class ProductBatchControllerIntegrationTest {

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private AuthService authService;

    @Autowired
    private AppUserRepository userRepository;

    @Autowired
    private AuthSessionRepository authSessionRepository;

    @Autowired
    private ProductBatchRepository batchRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private ProductCategoryRepository categoryRepository;

    @Autowired
    private ProductCodeControlRepository productCodeControlRepository;

    private MockMvc mockMvc;
    private String adminAuthHeader;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
        batchRepository.deleteAll();
        productRepository.deleteAll();
        authSessionRepository.deleteAll();
        userRepository.findAll()
                .stream()
                .filter(user -> !"admin".equalsIgnoreCase(user.getUsername()))
                .forEach(userRepository::delete);
        resetProductCodeSequence();
        adminAuthHeader = "Bearer " + authService.login(new LoginRequest("admin", "admin123")).token();
    }

    @Test
    void shouldCreateBatchGenerateLabelsAndTrackWorkflow() throws Exception {
        Long categoryId = categoryId();

        MvcResult createResult = mockMvc.perform(post("/api/product-batches")
                        .header("Authorization", adminAuthHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Recebimento Abril",
                                  "items": [
                                    {
                                      "name": "Vestido Lote",
                                      "code": "",
                                      "categoryId": %d,
                                      "price": 129.90,
                                      "stockQuantity": 2,
                                      "active": true
                                    },
                                    {
                                      "name": "Blusa Lote",
                                      "code": "IWR-BATCH-002",
                                      "categoryId": %d,
                                      "price": 59.90,
                                      "stockQuantity": 1,
                                      "active": true
                                    }
                                  ]
                                }
                                """.formatted(categoryId, categoryId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Recebimento Abril"))
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.totalProducts").value(2))
                .andExpect(jsonPath("$.totalPieces").value(3))
                .andExpect(jsonPath("$.products[0].code").value("IWR-000001"))
                .andExpect(jsonPath("$.products[0].categoryId").value(categoryId))
                .andReturn();

        Long batchId = batchRepository.findAll().getFirst().getId();
        if (!createResult.getResponse().getContentAsString().contains("\"id\":" + batchId)) {
            throw new AssertionError("Expected created batch id in response.");
        }

        mockMvc.perform(get("/api/product-batches/{batchId}/labels", batchId)
                        .header("Authorization", adminAuthHeader))
                .andExpect(status().isOk())
                .andExpect(result -> {
                    String html = result.getResponse().getContentAsString();
                    if (!html.contains("Recebimento Abril")
                            || !html.contains("Vestido Lote")
                            || !html.contains("Blusa Lote")
                            || !html.contains("Imprimir etiquetas")
                            || !html.contains("data:image/png;base64,")) {
                        throw new AssertionError("Expected printable batch labels HTML.");
                    }
                    if (html.contains("IWR-000001")
                            || html.contains("IWR-BATCH-002")
                            || html.contains("class=\"code\"")) {
                        throw new AssertionError("Product code must not be visible in batch labels.");
                    }
                });

        mockMvc.perform(patch("/api/product-batches/{batchId}/labels-printed", batchId)
                        .header("Authorization", adminAuthHeader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("LABELS_PRINTED"));

        mockMvc.perform(patch("/api/product-batches/{batchId}/cataloged", batchId)
                        .header("Authorization", adminAuthHeader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CATALOGED"));

        mockMvc.perform(patch("/api/product-batches/{batchId}/sent-to-store", batchId)
                        .header("Authorization", adminAuthHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "sentToStoreAt": "2026-04-26",
                                  "note": "Primeiro envio da semana"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SENT_TO_STORE"))
                .andExpect(jsonPath("$.sentToStoreAt").value("2026-04-26"))
                .andExpect(jsonPath("$.storeShipmentNote").value("Primeiro envio da semana"));
    }

    @Test
    void shouldRestrictBatchManagementToAdmin() throws Exception {
        Long categoryId = categoryId();

        mockMvc.perform(post("/api/users")
                        .header("Authorization", adminAuthHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "username": "catalogador",
                                  "displayName": "Vendedor Catalogacao",
                                  "password": "senha123",
                                  "role": "OPERATOR",
                                  "active": true
                                }
                                """))
                .andExpect(status().isCreated());

        String sellerAuthHeader = "Bearer "
                + authService.login(new LoginRequest("catalogador", "senha123")).token();

        mockMvc.perform(get("/api/product-batches")
                        .header("Authorization", sellerAuthHeader))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/product-batches")
                        .header("Authorization", sellerAuthHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Lote proibido",
                                  "items": [
                                    {
                                      "name": "Produto Proibido",
                                      "code": "",
                                      "categoryId": %d,
                                      "price": 49.90,
                                      "stockQuantity": 1,
                                      "active": true
                                    }
                                  ]
                                }
                                """.formatted(categoryId)))
                .andExpect(status().isForbidden());
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
