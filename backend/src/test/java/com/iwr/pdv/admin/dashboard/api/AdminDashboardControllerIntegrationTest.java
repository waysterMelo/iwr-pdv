package com.iwr.pdv.admin.dashboard.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.iwr.pdv.auth.api.dto.LoginRequest;
import com.iwr.pdv.auth.application.AuthService;
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
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
class AdminDashboardControllerIntegrationTest {

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private AuthService authService;

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
    private PromissoryNotePaymentRepository promissoryNotePaymentRepository;

    @Autowired
    private StockMovementRepository stockMovementRepository;

    @Autowired
    private CashMovementRepository cashMovementRepository;

    @Autowired
    private CashRegisterRepository cashRegisterRepository;

    @Autowired
    private Clock clock;

    private MockMvc mockMvc;
    private String authHeader;

    @BeforeEach
    void setUp() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
        authHeader = "Bearer " + authService.login(new LoginRequest("admin", "admin123")).token();
        cleanDatabase();
    }

    @AfterEach
    void tearDown() {
        cleanDatabase();
    }

    @Test
    void shouldReturnAdminDashboardSummaryPaymentMethodsReceivablesAndReport() throws Exception {
        Product cashProduct = productRepository.save(buildProduct("Vestido Admin", "ADM-001", new BigDecimal("110.00"), 5));
        Product pixProduct = productRepository.save(buildProduct("Blusa Admin", "ADM-002", new BigDecimal("50.00"), 5));
        Product promissoryProduct = productRepository.save(buildProduct("Conjunto Admin", "ADM-003", new BigDecimal("80.00"), 5));
        Customer customer = customerRepository.save(buildCustomer("Cliente Painel"));
        LocalDate today = LocalDate.now(clock);

        mockMvc.perform(post("/api/sales")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "items": [{"productId": %d, "quantity": 1}],
                                  "paymentMethod": "CASH",
                                  "discountAmount": 10.00,
                                  "amountReceived": 100.00
                                }
                                """.formatted(cashProduct.getId())))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/sales")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "items": [{"productId": %d, "quantity": 1}],
                                  "paymentMethod": "PIX",
                                  "discountAmount": 0
                                }
                                """.formatted(pixProduct.getId())))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/sales")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "items": [{"productId": %d, "quantity": 1}],
                                  "paymentMethod": "PROMISSORY_NOTE",
                                  "discountAmount": 0,
                                  "customerId": %d,
                                  "promissoryInstallments": [
                                    {"dueDate": "%s", "amount": 40.00},
                                    {"dueDate": "%s", "amount": 40.00}
                                  ]
                                }
                                """.formatted(promissoryProduct.getId(), customer.getId(), today, today.plusDays(10))))
                .andExpect(status().isCreated());

        PromissoryNote firstNote = promissoryNoteRepository.findAll()
                .stream()
                .filter(note -> note.getInstallmentNumber() == 1)
                .findFirst()
                .orElseThrow();

        mockMvc.perform(post("/api/promissory-notes/{noteId}/payments", firstNote.getId())
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"PIX\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/admin/dashboard/summary")
                        .header("Authorization", authHeader)
                        .param("startDate", today.toString())
                        .param("endDate", today.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalSold").value(230.00))
                .andExpect(jsonPath("$.totalReceived").value(190.00))
                .andExpect(jsonPath("$.totalDiscounts").value(10.00))
                .andExpect(jsonPath("$.saleCount").value(3))
                .andExpect(jsonPath("$.averageTicket").value(76.67))
                .andExpect(jsonPath("$.openReceivables").value(40.00))
                .andExpect(jsonPath("$.dueNext30DaysReceivables").value(40.00));

        mockMvc.perform(get("/api/admin/dashboard/payment-methods")
                        .header("Authorization", authHeader)
                        .param("startDate", today.toString())
                        .param("endDate", today.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].paymentMethod").value("CASH"))
                .andExpect(jsonPath("$[0].soldAmount").value(100.00))
                .andExpect(jsonPath("$[1].paymentMethod").value("PIX"))
                .andExpect(jsonPath("$[1].receivedAmount").value(90.00))
                .andExpect(jsonPath("$[4].paymentMethod").value("PROMISSORY_NOTE"))
                .andExpect(jsonPath("$[4].soldAmount").value(80.00));

        mockMvc.perform(get("/api/admin/dashboard/receivables")
                        .header("Authorization", authHeader)
                        .param("startDate", today.toString())
                        .param("endDate", today.plusDays(30).toString())
                        .param("calendarStartDate", today.toString())
                        .param("calendarEndDate", today.plusDays(30).toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.openAmount").value(40.00))
                .andExpect(jsonPath("$.calendarDays.length()").value(1))
                .andExpect(jsonPath("$.calendarDays[0].date").value(today.plusDays(10).toString()))
                .andExpect(jsonPath("$.calendarDays[0].amount").value(40.00))
                .andExpect(jsonPath("$.calendarDays[0].count").value(1))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].customerName").value("Cliente Painel"))
                .andExpect(jsonPath("$.topCustomers[0].openAmount").value(40.00));

        mockMvc.perform(get("/api/admin/dashboard/report")
                        .header("Authorization", authHeader)
                        .param("startDate", today.toString())
                        .param("endDate", today.toString()))
                .andExpect(status().isOk());
    }

    private Product buildProduct(String name, String code, BigDecimal price, int stockQuantity) {
        Product product = new Product();
        product.setName(name);
        product.setCode(code);
        product.setCategory(category());
        product.setPrice(price);
        product.setStockQuantity(stockQuantity);
        product.setActive(true);
        product.setCreatedAt(OffsetDateTime.now());
        product.setUpdatedAt(OffsetDateTime.now());
        return product;
    }

    private Customer buildCustomer(String name) {
        Customer customer = new Customer();
        customer.setName(name);
        customer.setCpf("99988877766");
        customer.setPhone("11999999999");
        customer.setActive(true);
        customer.setCreatedAt(OffsetDateTime.now());
        customer.setUpdatedAt(OffsetDateTime.now());
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
                    category.setCreatedAt(OffsetDateTime.now());
                    category.setUpdatedAt(OffsetDateTime.now());
                    return categoryRepository.save(category);
                });
    }

    private void cleanDatabase() {
        promissoryNotePaymentRepository.deleteAll();
        stockMovementRepository.deleteAll();
        promissoryNoteRepository.deleteAll();
        saleRepository.deleteAll();
        cashMovementRepository.deleteAll();
        cashRegisterRepository.deleteAll();
        customerRepository.deleteAll();
        productRepository.deleteAll();
    }
}
