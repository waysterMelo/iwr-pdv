package com.iwr.pdv.customer.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iwr.pdv.auth.api.dto.LoginRequest;
import com.iwr.pdv.auth.application.AuthService;
import com.iwr.pdv.auth.domain.AuthSessionRepository;
import com.iwr.pdv.cash.domain.CashMovementRepository;
import com.iwr.pdv.cash.domain.CashRegisterRepository;
import com.iwr.pdv.customer.domain.Customer;
import com.iwr.pdv.customer.domain.CustomerRepository;
import com.iwr.pdv.product.domain.Product;
import com.iwr.pdv.product.domain.ProductCategory;
import com.iwr.pdv.product.domain.ProductCategoryRepository;
import com.iwr.pdv.product.domain.ProductRepository;
import com.iwr.pdv.promissorynote.domain.PromissoryNote;
import com.iwr.pdv.promissorynote.domain.PromissoryNotePaymentRepository;
import com.iwr.pdv.promissorynote.domain.PromissoryNoteRepository;
import com.iwr.pdv.promissorynote.domain.PromissoryNoteStatus;
import com.iwr.pdv.sale.domain.SaleRepository;
import com.iwr.pdv.sale.domain.StockMovementRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
class CustomerControllerIntegrationTest {

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private AuthService authService;

    @Autowired
    private AuthSessionRepository authSessionRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private ProductCategoryRepository categoryRepository;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private SaleRepository saleRepository;

    @Autowired
    private PromissoryNoteRepository promissoryNoteRepository;

    @Autowired
    private PromissoryNotePaymentRepository paymentRepository;

    @Autowired
    private StockMovementRepository stockMovementRepository;

    @Autowired
    private CashMovementRepository cashMovementRepository;

    @Autowired
    private CashRegisterRepository cashRegisterRepository;

    @Autowired
    private Clock clock;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private MockMvc mockMvc;
    private String adminAuthHeader;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
        adminAuthHeader = "Bearer " + authService.login(new LoginRequest("admin", "admin123")).token();
        cleanDatabase();
    }

    @AfterEach
    void tearDown() {
        cleanDatabase();
        authSessionRepository.deleteAll();
    }

    @Test
    void shouldReturnCompleteCustomerProfileForAdminAndRejectOperator() throws Exception {
        Product product = productRepository.save(buildProduct("Vestido Completo", "CLI-PROF-001", new BigDecimal("20.00"), 60));
        Customer customer = customerRepository.save(buildCustomer("Cliente Perfil Completo"));

        for (int index = 0; index < 13; index++) {
            createCashSale(product.getId(), customer.getId(), 1);
        }

        Long cancelledSaleId = createCashSale(product.getId(), customer.getId(), 1);
        mockMvc.perform(post("/api/sales/{saleId}/cancel", cancelledSaleId)
                        .header("Authorization", adminAuthHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Cancelamento de auditoria\"}"))
                .andExpect(status().isOk());

        createPromissorySale(product.getId(), customer.getId());
        PromissoryNote partialNote = promissoryNoteRepository.findAll()
                .stream()
                .filter(note -> note.getInstallmentNumber() == 1)
                .findFirst()
                .orElseThrow();
        PromissoryNote overdueNote = promissoryNoteRepository.findAll()
                .stream()
                .filter(note -> note.getInstallmentNumber() == 2)
                .findFirst()
                .orElseThrow();
        overdueNote.setDueDate(LocalDate.now(clock).minusDays(3));
        overdueNote.setStatus(PromissoryNoteStatus.PENDING);
        promissoryNoteRepository.saveAndFlush(overdueNote);

        mockMvc.perform(post("/api/promissory-notes/{noteId}/payments", partialNote.getId())
                        .header("Authorization", adminAuthHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"PIX\",\"amount\":20.00,\"chargeInterestAndPenalty\":false}"))
                .andExpect(status().isOk());

        String operatorHeader = "Bearer " + createOperatorAndLogin();
        mockMvc.perform(get("/api/customers/{customerId}/profile", customer.getId())
                        .header("Authorization", operatorHeader))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/customers/{customerId}/profile", customer.getId())
                        .header("Authorization", adminAuthHeader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.saleCount").value(14))
                .andExpect(jsonPath("$.completedSaleCount").value(14))
                .andExpect(jsonPath("$.cancelledSaleCount").value(1))
                .andExpect(jsonPath("$.totalPurchasedAmount").value(360.00))
                .andExpect(jsonPath("$.sales.length()").value(15))
                .andExpect(jsonPath("$.latestSales.length()").value(12))
                .andExpect(jsonPath("$.cancelledSales.length()").value(1))
                .andExpect(jsonPath("$.purchasedItems[0].quantity").value(18))
                .andExpect(jsonPath("$.openPromissoryCount").value(2))
                .andExpect(jsonPath("$.overduePromissoryCount").value(1))
                .andExpect(jsonPath("$.promissoryNotes[0].payments.length()").exists())
                .andExpect(jsonPath("$.promissoryNotes[?(@.status == 'OVERDUE')].remainingAmount").isNotEmpty())
                .andExpect(jsonPath("$.promissoryNotes[?(@.status == 'PARTIALLY_PAID')].payments[0].amount").isNotEmpty());
    }

    @Test
    void shouldExportCustomerProfileCsvWithFiltersAndNeutralizedFormulaCells() throws Exception {
        Product product = productRepository.save(buildProduct("Blusa Exportacao", "CLI-CSV-001", new BigDecimal("20.00"), 10));
        Customer customer = customerRepository.save(buildCustomer("=HYPERLINK(\"http://evil.test\")"));

        createCashSale(product.getId(), customer.getId(), 1);
        createPromissorySale(product.getId(), customer.getId());

        mockMvc.perform(get("/api/customers/{customerId}/profile/export.csv", customer.getId())
                        .header("Authorization", adminAuthHeader)
                        .param("saleStatus", "COMPLETED")
                        .param("noteStatus", "PENDING"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=consulta-cliente-" + customer.getId() + ".csv"))
                .andExpect(result -> {
                    String csv = result.getResponse().getContentAsString();
                    if (!csv.contains("Dados do Cliente") || !csv.contains("Resumo Financeiro") || !csv.contains("Vendas e Itens") || !csv.contains("Promissorias")) {
                        throw new AssertionError("Expected customer profile CSV sections.");
                    }
                    if (!csv.contains("\"'=HYPERLINK(\"\"http://evil.test\"\")\"")) {
                        throw new AssertionError("Expected CSV formula to be neutralized.");
                    }
                    if (csv.contains("\"=HYPERLINK(")) {
                        throw new AssertionError("CSV must not expose executable spreadsheet formulas.");
                    }
                });
    }

    private Long createCashSale(Long productId, Long customerId, int quantity) throws Exception {
        String response = mockMvc.perform(post("/api/sales")
                        .header("Authorization", adminAuthHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "items": [{"productId": %d, "quantity": %d}],
                                  "paymentMethod": "CASH",
                                  "discountAmount": 0,
                                  "amountReceived": 1000.00,
                                  "customerId": %d
                                }
                                """.formatted(productId, quantity, customerId)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).get("id").asLong();
    }

    private void createPromissorySale(Long productId, Long customerId) throws Exception {
        LocalDate today = LocalDate.now(clock);
        mockMvc.perform(post("/api/sales")
                        .header("Authorization", adminAuthHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "items": [{"productId": %d, "quantity": 5}],
                                  "paymentMethod": "PROMISSORY_NOTE",
                                  "discountAmount": 0,
                                  "customerId": %d,
                                  "promissoryInstallments": [
                                    {"dueDate": "%s", "amount": 50.00},
                                    {"dueDate": "%s", "amount": 50.00}
                                  ]
                                }
                                """.formatted(productId, customerId, today.plusDays(5), today.plusDays(10))))
                .andExpect(status().isCreated());
    }

    private String createOperatorAndLogin() throws Exception {
        String username = "operador" + System.nanoTime();
        mockMvc.perform(post("/api/users")
                        .header("Authorization", adminAuthHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "username": "%s",
                                  "displayName": "Operador Cliente",
                                  "password": "senha123",
                                  "role": "OPERATOR",
                                  "active": true
                                }
                                """.formatted(username)))
                .andExpect(status().isCreated());
        return authService.login(new LoginRequest(username, "senha123")).token();
    }

    private Product buildProduct(String name, String code, BigDecimal price, int stockQuantity) {
        Product product = new Product();
        product.setName(name);
        product.setCode(code);
        product.setCategory(category());
        product.setPrice(price);
        product.setStockQuantity(stockQuantity);
        product.setActive(true);
        product.setCreatedAt(OffsetDateTime.now(clock));
        product.setUpdatedAt(OffsetDateTime.now(clock));
        return product;
    }

    private Customer buildCustomer(String name) {
        Customer customer = new Customer();
        customer.setName(name);
        customer.setCpf("11122233344");
        customer.setPhone("11999999999");
        customer.setActive(true);
        customer.setCreatedAt(OffsetDateTime.now(clock));
        customer.setUpdatedAt(OffsetDateTime.now(clock));
        return customer;
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
                    category.setCreatedAt(OffsetDateTime.now(clock));
                    category.setUpdatedAt(OffsetDateTime.now(clock));
                    return categoryRepository.save(category);
                });
    }

    private void cleanDatabase() {
        paymentRepository.deleteAll();
        stockMovementRepository.deleteAll();
        promissoryNoteRepository.deleteAll();
        saleRepository.deleteAll();
        cashMovementRepository.deleteAll();
        cashRegisterRepository.deleteAll();
        customerRepository.deleteAll();
        productRepository.deleteAll();
    }
}
