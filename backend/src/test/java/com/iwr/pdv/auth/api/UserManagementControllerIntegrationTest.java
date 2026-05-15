package com.iwr.pdv.auth.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.iwr.pdv.auth.api.dto.LoginRequest;
import com.iwr.pdv.auth.application.AuthService;
import com.iwr.pdv.auth.domain.AppUserRepository;
import com.iwr.pdv.auth.domain.AuthSessionRepository;
import com.iwr.pdv.cash.domain.CashMovementRepository;
import com.iwr.pdv.cash.domain.CashRegisterRepository;
import com.iwr.pdv.cash.domain.CashRegisterStatus;
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
class UserManagementControllerIntegrationTest {

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private AuthService authService;

    @Autowired
    private AppUserRepository userRepository;

    @Autowired
    private AuthSessionRepository authSessionRepository;

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

    private MockMvc mockMvc;
    private String adminAuthHeader;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
        stockMovementRepository.deleteAll();
        saleRepository.deleteAll();
        cashMovementRepository.deleteAll();
        cashRegisterRepository.deleteAll();
        productRepository.deleteAll();
        authSessionRepository.deleteAll();
        userRepository.findAll()
                .stream()
                .filter(user -> !"admin".equalsIgnoreCase(user.getUsername()))
                .forEach(userRepository::delete);
        adminAuthHeader = "Bearer " + authService.login(new LoginRequest("admin", "admin123")).token();
    }

    @Test
    void shouldCreateUsersAndReturnSellerDisplayNameOnLogin() throws Exception {
        mockMvc.perform(post("/api/users")
                        .header("Authorization", adminAuthHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "username": "maria",
                                  "displayName": "Maria Vendedora",
                                  "password": "senha123",
                                  "role": "OPERATOR",
                                  "active": true
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.username").value("maria"))
                .andExpect(jsonPath("$.displayName").value("Maria Vendedora"))
                .andExpect(jsonPath("$.role").value("OPERATOR"))
                .andExpect(jsonPath("$.active").value(true));

        mockMvc.perform(post("/api/users")
                        .header("Authorization", adminAuthHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "username": "gerente",
                                  "displayName": "Gerente",
                                  "password": "senha123",
                                  "role": "ADMIN",
                                  "active": true
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("ADMIN"));

        mockMvc.perform(get("/api/users")
                        .header("Authorization", adminAuthHeader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(3))
                .andExpect(jsonPath("$.totalElements").value(3));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "username": "maria",
                                  "password": "senha123"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.displayName").value("Maria Vendedora"))
                .andExpect(jsonPath("$.user.role").value("OPERATOR"));
    }

    @Test
    void shouldUpdateUserAndPassword() throws Exception {
        Long userId = createSellerAndReturnId("ana", "Ana");

        mockMvc.perform(put("/api/users/{userId}", userId)
                        .header("Authorization", adminAuthHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "username": "ana.silva",
                                  "displayName": "Ana Silva",
                                  "role": "OPERATOR",
                                  "active": true
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("ana.silva"))
                .andExpect(jsonPath("$.displayName").value("Ana Silva"));

        mockMvc.perform(patch("/api/users/{userId}/password", userId)
                        .header("Authorization", adminAuthHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"nova123\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "username": "ana.silva",
                                  "password": "nova123"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.displayName").value("Ana Silva"));
    }

    @Test
    void shouldRestrictSellerToSalesAndCashRegister() throws Exception {
        String sellerHeader = "Bearer " + createSellerAndLogin("joao", "Joao Vendedor");
        Product product = productRepository.save(buildProduct("Blusa Barcode", "IWR-SELLER-001", new BigDecimal("30.00"), 3, true));

        mockMvc.perform(get("/api/users")
                        .header("Authorization", sellerHeader))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/products")
                        .header("Authorization", sellerHeader))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/sales")
                        .header("Authorization", sellerHeader))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/cash-register/open")
                        .header("Authorization", sellerHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"openingAmount\":100.00}"))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/sales/product-by-code")
                        .header("Authorization", sellerHeader)
                        .param("code", "IWR-SELLER-001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(product.getId()));

        mockMvc.perform(post("/api/sales")
                        .header("Authorization", sellerHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
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
                                """.formatted(product.getId())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.operator.displayName").value("Joao Vendedor"));

        Long cashRegisterId = cashRegisterRepository.findFirstByStatusOrderByOpenedAtDesc(CashRegisterStatus.OPEN)
                .orElseThrow()
                .getId();

        mockMvc.perform(post("/api/cash-register/{cashRegisterId}/close", cashRegisterId)
                        .header("Authorization", sellerHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"declaredCashAmount\":100.00}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CLOSED"));

        mockMvc.perform(get("/api/cash-register")
                        .header("Authorization", sellerHeader)
                        .param("status", "CLOSED"))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/cash-register/{cashRegisterId}/report", cashRegisterId)
                        .header("Authorization", sellerHeader))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/cash-register/{cashRegisterId}/reopen", cashRegisterId)
                        .header("Authorization", sellerHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Gerente ausente, ajuste operacional\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldRejectDuplicateUsernameAndPreserveOneActiveAdmin() throws Exception {
        createSellerAndReturnId("duplicado", "Duplicado");

        mockMvc.perform(post("/api/users")
                        .header("Authorization", adminAuthHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "username": "DUPLICADO",
                                  "displayName": "Outro",
                                  "password": "senha123",
                                  "role": "OPERATOR",
                                  "active": true
                                }
                                """))
                .andExpect(status().isConflict());

        Long adminId = userRepository.findByUsernameIgnoreCase("admin").orElseThrow().getId();
        mockMvc.perform(put("/api/users/{userId}", adminId)
                        .header("Authorization", adminAuthHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "username": "admin",
                                  "displayName": "Administrador",
                                  "role": "OPERATOR",
                                  "active": true
                                }
                                """))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.message").value("At least one active admin user is required."));
    }

    private Long createSellerAndReturnId(String username, String displayName) throws Exception {
        mockMvc.perform(post("/api/users")
                        .header("Authorization", adminAuthHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "username": "%s",
                                  "displayName": "%s",
                                  "password": "senha123",
                                  "role": "OPERATOR",
                                  "active": true
                                }
                                """.formatted(username, displayName)))
                .andExpect(status().isCreated());

        return userRepository.findByUsernameIgnoreCase(username).orElseThrow().getId();
    }

    private String createSellerAndLogin(String username, String displayName) throws Exception {
        createSellerAndReturnId(username, displayName);
        return authService.login(new LoginRequest(username, "senha123")).token();
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
