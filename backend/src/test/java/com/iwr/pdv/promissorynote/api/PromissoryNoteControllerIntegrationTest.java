package com.iwr.pdv.promissorynote.api;

import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.startsWith;
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
class PromissoryNoteControllerIntegrationTest {

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
    private PromissoryNotePaymentRepository paymentRepository;



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
    void shouldHandlePartialPaymentsCollectionWhatsappDelinquencyAndRenegotiation() throws Exception {
        Product product = productRepository.save(buildProduct("Conjunto Fiado", "PROM-001", new BigDecimal("80.00"), 5));
        Customer customer = customerRepository.save(buildCustomer("Cliente Promissoria"));
        LocalDate today = LocalDate.now(clock);

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
                                """.formatted(product.getId(), customer.getId(), today, today.plusDays(10))))
                .andExpect(status().isCreated());

        PromissoryNote overdueNote = promissoryNoteRepository.findAll()
                .stream()
                .filter(note -> note.getInstallmentNumber() == 1)
                .findFirst()
                .orElseThrow();
        overdueNote.setDueDate(today.minusDays(10));
        overdueNote = promissoryNoteRepository.save(overdueNote);
        PromissoryNote futureNote = promissoryNoteRepository.findAll()
                .stream()
                .filter(note -> note.getInstallmentNumber() == 2)
                .findFirst()
                .orElseThrow();

        mockMvc.perform(post("/api/promissory-notes/{noteId}/payments", overdueNote.getId())
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"PIX\",\"amount\":20.00,\"chargeInterestAndPenalty\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PARTIALLY_PAID"))
                .andExpect(jsonPath("$.paidAmount").value(20.00))
                .andExpect(jsonPath("$.remainingAmount").value(20.00));

        mockMvc.perform(get("/api/promissory-notes/{noteId}/payments", overdueNote.getId())
                        .header("Authorization", authHeader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].amount").value(20.00))
                .andExpect(jsonPath("$[0].totalReceived").value(22.00));



        mockMvc.perform(get("/api/promissory-notes/{noteId}/whatsapp-message", overdueNote.getId())
                        .header("Authorization", authHeader)
                        .param("pixKey", "11999999999"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").value(startsWith("Ola, Cliente Promissoria")));

        mockMvc.perform(get("/api/promissory-notes/delinquency-report")
                        .header("Authorization", authHeader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[2].range").value("8 a 15 dias vencido"))
                .andExpect(jsonPath("$[2].amount").value(20.00))
                .andExpect(jsonPath("$[2].count").value(greaterThan(0)));


    }

    @Test
    void shouldNeutralizeSpreadsheetFormulasWhenExportingCsv() throws Exception {
        Product product = productRepository.save(buildProduct("Conjunto Fiado", "PROM-CSV-001", new BigDecimal("80.00"), 5));
        Customer customer = customerRepository.save(buildCustomer("=HYPERLINK(\"http://evil.test\")"));
        LocalDate today = LocalDate.now(clock);

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
                                    {"dueDate": "%s", "amount": 80.00}
                                  ]
                                }
                                """.formatted(product.getId(), customer.getId(), today)))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/promissory-notes/export.csv")
                        .header("Authorization", authHeader))
                .andExpect(status().isOk())
                .andExpect(result -> {
                    String csv = result.getResponse().getContentAsString();
                    if (!csv.contains("\"'=HYPERLINK(\"\"http://evil.test\"\")\"")) {
                        throw new AssertionError("Expected CSV formula to be neutralized.");
                    }
                    if (csv.contains("\"=HYPERLINK(")) {
                        throw new AssertionError("CSV must not expose executable spreadsheet formulas.");
                    }
                });
    }

    @Test
    void shouldCreateManualPromissoryNotesWithoutSaleAndExportThem() throws Exception {
        Product product = productRepository.save(buildProduct("Produto Manual", "PROM-MAN-001", new BigDecimal("150.00"), 10));
        Customer customer = customerRepository.save(buildCustomer("Cliente Legado"));
        LocalDate today = LocalDate.now(clock);

        mockMvc.perform(post("/api/promissory-notes/manual")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "customerId": %d,
                                  "items": [
                                    {"productId": %d, "quantity": 1, "unitPrice": 150.00}
                                  ],
                                  "discountAmount": 0.00,
                                  "installments": [
                                    {"dueDate": "%s", "amount": 75.00},
                                    {"dueDate": "%s", "amount": 75.00}
                                  ]
                                }
                                """.formatted(customer.getId(), product.getId(), today.plusDays(5), today.plusDays(35))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].saleId").value(nullValue()))
                .andExpect(jsonPath("$[0].customer.name").value("Cliente Legado"))
                .andExpect(jsonPath("$[0].amount").value(75.00));

        mockMvc.perform(get("/api/promissory-notes")
                        .header("Authorization", authHeader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].saleId").value(nullValue()));

        mockMvc.perform(get("/api/promissory-notes/export.csv")
                        .header("Authorization", authHeader))
                .andExpect(status().isOk())
                .andExpect(result -> {
                    String csv = result.getResponse().getContentAsString();
                    if (!csv.contains("Avulsa")) {
                        throw new AssertionError("Expected manual promissory notes to be exported as Avulsa.");
                    }
                    if (!csv.contains("\"Cliente Legado\"")) {
                        throw new AssertionError("Expected manual promissory note customer in CSV.");
                    }
                });
    }

    @Test
    void shouldReturnOpenNotesGroupedByDueDateForCalendar() throws Exception {
        Product product = productRepository.save(buildProduct("Conjunto Calendario", "PROM-CAL-001", new BigDecimal("120.00"), 5));
        Customer customer = customerRepository.save(buildCustomer("Cliente Calendario"));
        LocalDate today = LocalDate.now(clock);
        LocalDate dueDate = today.plusDays(4);

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
                                    {"dueDate": "%s", "amount": 50.00},
                                    {"dueDate": "%s", "amount": 70.00}
                                  ]
                                }
                                """.formatted(product.getId(), customer.getId(), dueDate, dueDate)))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/promissory-notes/calendar-days")
                        .header("Authorization", authHeader)
                        .param("startDate", dueDate.withDayOfMonth(1).toString())
                        .param("endDate", dueDate.withDayOfMonth(dueDate.lengthOfMonth()).toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].date").value(dueDate.toString()))
                .andExpect(jsonPath("$[0].amount").value(120.00))
                .andExpect(jsonPath("$[0].count").value(2));
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
