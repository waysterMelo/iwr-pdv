package com.iwr.pdv.customer.application;

import com.iwr.pdv.common.exception.ResourceConflictException;
import com.iwr.pdv.common.exception.ResourceNotFoundException;
import com.iwr.pdv.customer.api.dto.CustomerPageResponse;
import com.iwr.pdv.customer.api.dto.CustomerProfileInsightResponse;
import com.iwr.pdv.customer.api.dto.CustomerProfileResponse;
import com.iwr.pdv.customer.api.dto.CustomerPromissoryNoteResponse;
import com.iwr.pdv.customer.api.dto.CustomerPurchasedItemResponse;
import com.iwr.pdv.customer.api.dto.CustomerRequest;
import com.iwr.pdv.customer.api.dto.CustomerResponse;
import com.iwr.pdv.customer.domain.Customer;
import com.iwr.pdv.customer.domain.CustomerRepository;
import com.iwr.pdv.customer.mapper.CustomerMapper;
import com.iwr.pdv.promissorynote.api.dto.PromissoryNotePaymentResponse;
import com.iwr.pdv.promissorynote.api.dto.PromissoryNoteResponse;
import com.iwr.pdv.promissorynote.domain.PromissoryNote;
import com.iwr.pdv.promissorynote.domain.PromissoryNotePaymentRepository;
import com.iwr.pdv.promissorynote.domain.PromissoryNoteRepository;
import com.iwr.pdv.promissorynote.domain.PromissoryNoteStatus;
import com.iwr.pdv.promissorynote.mapper.PromissoryNoteMapper;
import com.iwr.pdv.sale.domain.Sale;
import com.iwr.pdv.sale.domain.SaleItem;
import com.iwr.pdv.sale.domain.SaleRepository;
import com.iwr.pdv.sale.domain.SaleStatus;
import com.iwr.pdv.sale.mapper.SaleMapper;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CustomerServiceImpl implements CustomerService {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    private static final Set<PromissoryNoteStatus> OPEN_NOTE_STATUSES = Set.of(
            PromissoryNoteStatus.PENDING,
            PromissoryNoteStatus.PARTIALLY_PAID,
            PromissoryNoteStatus.OVERDUE
    );

    private final CustomerRepository customerRepository;
    private final CustomerMapper customerMapper;
    private final SaleRepository saleRepository;
    private final SaleMapper saleMapper;
    private final PromissoryNoteRepository promissoryNoteRepository;
    private final PromissoryNotePaymentRepository promissoryNotePaymentRepository;
    private final PromissoryNoteMapper promissoryNoteMapper;
    private final Clock clock;

    public CustomerServiceImpl(
            CustomerRepository customerRepository,
            CustomerMapper customerMapper,
            SaleRepository saleRepository,
            SaleMapper saleMapper,
            PromissoryNoteRepository promissoryNoteRepository,
            PromissoryNotePaymentRepository promissoryNotePaymentRepository,
            PromissoryNoteMapper promissoryNoteMapper,
            Clock clock
    ) {
        this.customerRepository = customerRepository;
        this.customerMapper = customerMapper;
        this.saleRepository = saleRepository;
        this.saleMapper = saleMapper;
        this.promissoryNoteRepository = promissoryNoteRepository;
        this.promissoryNotePaymentRepository = promissoryNotePaymentRepository;
        this.promissoryNoteMapper = promissoryNoteMapper;
        this.clock = clock;
    }

    @Override
    @Transactional(readOnly = true)
    public List<CustomerResponse> list(String search) {
        String normalizedSearch = normalize(search);
        List<Customer> customers = normalizedSearch == null
                ? customerRepository.findTop40ByActiveTrueOrderByNameAsc()
                : customerRepository.findTop40ByActiveTrueAndNameContainingIgnoreCaseOrderByNameAsc(normalizedSearch);

        return customers.stream().map(customerMapper::toResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public CustomerPageResponse listPage(String search, int page, int size) {
        String normalizedSearch = normalize(search);
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 30);
        PageRequest pageRequest = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.ASC, "name"));

        Page<Customer> customers = normalizedSearch == null
                ? customerRepository.findByActiveTrue(pageRequest)
                : customerRepository.findByActiveTrueAndNameContainingIgnoreCase(normalizedSearch, pageRequest);

        return new CustomerPageResponse(
                customers.getContent().stream().map(customerMapper::toResponse).toList(),
                customers.getNumber(),
                customers.getSize(),
                customers.getTotalElements(),
                customers.getTotalPages(),
                customers.isFirst(),
                customers.isLast()
        );
    }

    @Override
    @Transactional(readOnly = true)
    public List<CustomerResponse> birthdays() {
        return customerRepository.findByActiveTrueAndBirthDateIsNotNullOrderByNameAsc()
                .stream()
                .map(customerMapper::toResponse)
                .toList();
    }

    @Override
    @Transactional
    public CustomerProfileResponse profile(Long customerId) {
        refreshOverdueStatuses();
        Customer customer = customerRepository.findProfileWithSalesById(customerId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found for id " + customerId + "."));
        
        customerRepository.findProfileWithNotesById(customerId);
        
        List<Sale> sales = customer.getSales().stream()
                .sorted(Comparator.comparing(Sale::getSoldAt).reversed())
                .toList();
        List<PromissoryNote> notes = customer.getPromissoryNotes().stream()
                .sorted(Comparator.comparing(PromissoryNote::getDueDate).reversed())
                .toList();

        List<Sale> completedSales = sales.stream()
                .filter(sale -> sale.getStatus() == SaleStatus.COMPLETED)
                .toList();
        List<Sale> cancelledSales = sales.stream()
                .filter(sale -> sale.getStatus() == SaleStatus.CANCELLED)
                .toList();
        Map<Long, PurchasedItemAccumulator> purchasedItems = new LinkedHashMap<>();

        for (Sale sale : completedSales) {
            for (SaleItem item : sale.getItems()) {
                purchasedItems.computeIfAbsent(
                                item.getProduct().getId(),
                                productId -> new PurchasedItemAccumulator(
                                        item.getProduct().getId(),
                                        item.getProductName(),
                                        item.getProductCode()
                                )
                        )
                        .add(item, sale.getSoldAt());
            }
        }

        BigDecimal totalPurchasedAmount = completedSales.stream()
                .map(Sale::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalDiscountAmount = completedSales.stream()
                .map(Sale::getDiscountAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal averageTicketAmount = completedSales.isEmpty()
                ? BigDecimal.ZERO
                : totalPurchasedAmount.divide(BigDecimal.valueOf(completedSales.size()), 2, RoundingMode.HALF_UP);
        BigDecimal openPromissoryAmount = notes.stream()
                .filter(this::isOpenNote)
                .map(this::remainingAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal overduePromissoryAmount = notes.stream()
                .filter(note -> note.getStatus() == PromissoryNoteStatus.OVERDUE)
                .map(this::remainingAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal paidPromissoryAmount = notes.stream()
                .map(note -> note.getPaidAmount() == null ? BigDecimal.ZERO : note.getPaidAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new CustomerProfileResponse(
                customerMapper.toResponse(customer),
                completedSales.size(),
                completedSales.size(),
                cancelledSales.size(),
                totalPurchasedAmount,
                totalDiscountAmount,
                averageTicketAmount,
                notes.stream().filter(this::isOpenNote).count(),
                notes.stream().filter(note -> note.getStatus() == PromissoryNoteStatus.OVERDUE).count(),
                notes.stream().filter(note -> note.getStatus() == PromissoryNoteStatus.PAID).count(),
                notes.stream().filter(note -> note.getStatus() == PromissoryNoteStatus.CANCELLED).count(),
                openPromissoryAmount,
                overduePromissoryAmount,
                paidPromissoryAmount,
                purchasedItems.values()
                        .stream()
                        .map(PurchasedItemAccumulator::toResponse)
                        .toList(),
                sales.stream().limit(12).map(saleMapper::toResponse).toList(),
                sales.stream().map(saleMapper::toResponse).toList(),
                cancelledSales.stream().map(saleMapper::toResponse).toList(),
                notes.stream()
                        .map(this::toCustomerPromissoryNoteResponse)
                        .toList(),
                buildProfileInsights(
                        customer,
                        completedSales,
                        notes,
                        openPromissoryAmount,
                        overduePromissoryAmount,
                        totalPurchasedAmount,
                        averageTicketAmount
                )
        );
    }

    @Override
    @Transactional
    public String exportProfileCsv(
            Long customerId,
            LocalDate startDate,
            LocalDate endDate,
            SaleStatus saleStatus,
            PromissoryNoteStatus noteStatus
    ) {
        CustomerProfileResponse profile = profile(customerId);
        List<com.iwr.pdv.sale.api.dto.SaleResponse> sales = filterSales(profile.sales(), startDate, endDate, saleStatus);
        List<CustomerPromissoryNoteResponse> notes = filterNotes(profile.promissoryNotes(), startDate, endDate, noteStatus);

        StringBuilder csv = new StringBuilder();
        csv.append("Dados do Cliente\n");
        csv.append("Nome;CPF;Telefone;Email;Endereco;Rua;Numero;Bairro;Complemento;Cidade;UF;CEP;Status\n");
        CustomerResponse customer = profile.customer();
        csv.append(csvCell(customer.name())).append(';')
                .append(csvCell(customer.cpf())).append(';')
                .append(csvCell(customer.phone())).append(';')
                .append(csvCell(customer.email())).append(';')
                .append(csvCell(customer.address())).append(';')
                .append(csvCell(customer.addressStreet())).append(';')
                .append(csvCell(customer.addressNumber())).append(';')
                .append(csvCell(customer.addressNeighborhood())).append(';')
                .append(csvCell(customer.addressComplement())).append(';')
                .append(csvCell(customer.addressCity())).append(';')
                .append(csvCell(customer.addressState())).append(';')
                .append(csvCell(customer.addressZipCode())).append(';')
                .append(customer.active() ? "Ativo" : "Inativo")
                .append("\n\n");

        csv.append("Resumo Financeiro\n");
        csv.append("Compras concluidas;Vendas canceladas;Total comprado;Descontos;Ticket medio;Valor em aberto;Valor vencido;Valor pago\n");
        csv.append(profile.completedSaleCount()).append(';')
                .append(profile.cancelledSaleCount()).append(';')
                .append(formatMoney(profile.totalPurchasedAmount())).append(';')
                .append(formatMoney(profile.totalDiscountAmount())).append(';')
                .append(formatMoney(profile.averageTicketAmount())).append(';')
                .append(formatMoney(profile.openPromissoryAmount())).append(';')
                .append(formatMoney(profile.overduePromissoryAmount())).append(';')
                .append(formatMoney(profile.paidPromissoryAmount()))
                .append("\n\n");

        csv.append("Vendas e Itens\n");
        csv.append("Venda;Status;Data;Pagamento;Operador;Produto;Codigo;Quantidade;Unitario;Subtotal;Desconto;Total;Cancelamento\n");
        for (com.iwr.pdv.sale.api.dto.SaleResponse sale : sales) {
            for (com.iwr.pdv.sale.api.dto.SaleItemResponse item : sale.items()) {
                csv.append(sale.id()).append(';')
                        .append(statusLabel(sale.status())).append(';')
                        .append(formatDateTime(sale.soldAt())).append(';')
                        .append(paymentMethodLabel(sale.paymentMethod())).append(';')
                        .append(csvCell(sale.operator() == null ? null : sale.operator().displayName())).append(';')
                        .append(csvCell(item.productName())).append(';')
                        .append(csvCell(item.productCode())).append(';')
                        .append(item.quantity()).append(';')
                        .append(formatMoney(item.unitPrice())).append(';')
                        .append(formatMoney(item.subtotal())).append(';')
                        .append(formatMoney(sale.discountAmount())).append(';')
                        .append(formatMoney(sale.totalAmount())).append(';')
                        .append(csvCell(sale.cancellationReason()))
                        .append('\n');
            }
        }

        csv.append("\nPromissorias\n");
        csv.append("Nota;Venda;Parcela;Status;Vencimento;Valor;Pago;Restante;Atualizado;Dias vencido;Pagamento final\n");
        for (CustomerPromissoryNoteResponse note : notes) {
            csv.append(note.id()).append(';')
                    .append(note.saleId() == null ? "Avulsa" : note.saleId()).append(';')
                    .append(note.installmentNumber()).append('/').append(note.totalInstallments()).append(';')
                    .append(statusLabel(note.status())).append(';')
                    .append(formatDate(note.dueDate())).append(';')
                    .append(formatMoney(note.amount())).append(';')
                    .append(formatMoney(note.paidAmount())).append(';')
                    .append(formatMoney(note.remainingAmount())).append(';')
                    .append(formatMoney(note.updatedAmount())).append(';')
                    .append(note.daysOverdue()).append(';')
                    .append(note.paymentMethod() == null ? "" : paymentMethodLabel(note.paymentMethod()))
                    .append('\n');
        }

        csv.append("\nPagamentos\n");
        csv.append("Nota;Data;Metodo;Valor;Juros;Multa;Total recebido;Recebido por\n");
        for (CustomerPromissoryNoteResponse note : notes) {
            for (PromissoryNotePaymentResponse payment : note.payments()) {
                csv.append(note.id()).append(';')
                        .append(formatDateTime(payment.paidAt())).append(';')
                        .append(paymentMethodLabel(payment.paymentMethod())).append(';')
                        .append(formatMoney(payment.amount())).append(';')
                        .append(formatMoney(payment.interestAmount())).append(';')
                        .append(formatMoney(payment.penaltyAmount())).append(';')
                        .append(formatMoney(payment.totalReceived())).append(';')
                        .append(csvCell(payment.paidBy() == null ? null : payment.paidBy().displayName()))
                        .append('\n');
            }
        }

        return csv.toString();
    }

    @Override
    @Transactional
    public CustomerResponse create(CustomerRequest request) {
        validateUniqueFields(request, null);

        OffsetDateTime now = OffsetDateTime.now(clock);
        Customer customer = new Customer();
        customer.setCreatedAt(now);
        customer.setUpdatedAt(now);
        apply(customer, request);

        return customerMapper.toResponse(customerRepository.save(customer));
    }


    @Override
    @Transactional
    public CustomerResponse update(Long customerId, CustomerRequest request) {
        Customer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found for id " + customerId + "."));
        validateUniqueFields(request, customerId);

        apply(customer, request);
        customer.setUpdatedAt(OffsetDateTime.now(clock));

        return customerMapper.toResponse(customer);
    }

    private void apply(Customer customer, CustomerRequest request) {
        customer.setName(request.name().trim());
        customer.setCpf(normalize(request.cpf()));
        customer.setPhone(normalize(request.phone()));
        customer.setEmail(normalize(request.email()));
        customer.setAddressStreet(normalize(request.addressStreet()));
        customer.setAddressNumber(normalize(request.addressNumber()));
        customer.setAddressNeighborhood(normalize(request.addressNeighborhood()));
        customer.setAddressComplement(normalize(request.addressComplement()));
        customer.setAddressCity(normalize(request.addressCity()));
        customer.setAddressState(normalize(request.addressState()) == null ? null : normalize(request.addressState()).toUpperCase());
        customer.setAddressZipCode(normalize(request.addressZipCode()));
        customer.setAddress(normalize(request.address()) == null ? buildAddress(request) : normalize(request.address()));
        customer.setBirthDate(request.birthDate());
        customer.setActive(request.active() == null || request.active());
        customer.setObservations(request.observations() != null ? request.observations().trim() : null);
        customer.setCreditLimit(request.creditLimit());
    }

    private void validateUniqueFields(CustomerRequest request, Long currentCustomerId) {
        String cpf = normalize(request.cpf());
        if (cpf != null) {
            customerRepository.findByCpf(cpf)
                    .filter(customer -> !customer.getId().equals(currentCustomerId))
                    .ifPresent(customer -> {
                        throw new ResourceConflictException("There is already a customer with this CPF.");
                    });
        }

        String email = normalize(request.email());
        if (email != null) {
            customerRepository.findByEmailIgnoreCase(email)
                    .filter(customer -> !customer.getId().equals(currentCustomerId))
                    .ifPresent(customer -> {
                        throw new ResourceConflictException("There is already a customer with this email.");
                    });
        }
    }

    private String normalize(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        return value.trim();
    }

    private String buildAddress(CustomerRequest request) {
        List<String> parts = new java.util.ArrayList<>();
        String street = normalize(request.addressStreet());
        String number = normalize(request.addressNumber());
        String neighborhood = normalize(request.addressNeighborhood());
        String city = normalize(request.addressCity());
        String state = normalize(request.addressState());

        if (street != null && number != null) {
            parts.add(street + ", " + number);
        } else if (street != null) {
            parts.add(street);
        } else if (number != null) {
            parts.add("Nº " + number);
        }
        if (neighborhood != null) {
            parts.add(neighborhood);
        }
        if (city != null && state != null) {
            parts.add(city + "/" + state.toUpperCase());
        } else if (city != null) {
            parts.add(city);
        } else if (state != null) {
            parts.add(state.toUpperCase());
        }

        return parts.isEmpty() ? null : String.join(" - ", parts);
    }

    private boolean isOpenNote(PromissoryNote note) {
        return OPEN_NOTE_STATUSES.contains(note.getStatus());
    }

    private BigDecimal remainingAmount(PromissoryNote note) {
        BigDecimal paidAmount = note.getPaidAmount() == null ? BigDecimal.ZERO : note.getPaidAmount();
        BigDecimal remaining = note.getAmount().subtract(paidAmount);
        return remaining.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : remaining;
    }

    private void refreshOverdueStatuses() {
        promissoryNoteRepository.markPendingNotesOverdue(LocalDate.now(clock), OffsetDateTime.now(clock));
    }

    private List<CustomerProfileInsightResponse> buildProfileInsights(
            Customer customer,
            List<Sale> completedSales,
            List<PromissoryNote> notes,
            BigDecimal openPromissoryAmount,
            BigDecimal overduePromissoryAmount,
            BigDecimal totalPurchasedAmount,
            BigDecimal averageTicketAmount
    ) {
        List<CustomerProfileInsightResponse> insights = new java.util.ArrayList<>();
        LocalDate today = LocalDate.now(clock);
        List<PromissoryNote> overdueNotes = notes.stream()
                .filter(note -> note.getStatus() == PromissoryNoteStatus.OVERDUE)
                .toList();
        long openCount = notes.stream().filter(this::isOpenNote).count();
        long maxOverdueDays = overdueNotes.stream()
                .mapToLong(note -> Math.max(0, ChronoUnit.DAYS.between(note.getDueDate(), today)))
                .max()
                .orElse(0);

        if (openPromissoryAmount.compareTo(BigDecimal.ZERO) == 0 && !completedSales.isEmpty()) {
            insights.add(insight(
                    "GOOD_PAYER",
                    CustomerProfileInsightResponse.Severity.SUCCESS,
                    "Cliente em dia",
                    "Nao ha parcelas em aberto para este cliente.",
                    "Cliente apto para novas vendas, respeitando o limite de credito cadastrado."
            ));
        }

        if (!overdueNotes.isEmpty()) {
            insights.add(insight(
                    "OVERDUE_BALANCE",
                    CustomerProfileInsightResponse.Severity.WARNING,
                    "Parcelas vencidas",
                    "%d parcela(s) vencida(s), somando R$ %s, com atraso maximo de %d dia(s)."
                            .formatted(overdueNotes.size(), formatMoney(overduePromissoryAmount), maxOverdueDays),
                    "Priorize contato de cobranca e registre qualquer acordo nas observacoes administrativas."
            ));
        }

        if (maxOverdueDays > 30) {
            insights.add(insight(
                    "CREDIT_SUSPENSION_RECOMMENDED",
                    CustomerProfileInsightResponse.Severity.DANGER,
                    "Risco alto de inadimplencia",
                    "Existe atraso superior a 30 dias no historico financeiro do cliente.",
                    "Suspenda novas vendas a prazo ate que a pendencia seja regularizada."
            ));
        }

        if (openCount > 0 && overdueNotes.isEmpty()) {
            insights.add(insight(
                    "OPEN_BALANCE",
                    CustomerProfileInsightResponse.Severity.INFO,
                    "Saldo em aberto",
                    "%d parcela(s) ainda em aberto, sem vencimento atrasado no momento.".formatted(openCount),
                    "Acompanhe os proximos vencimentos e mantenha o cliente informado."
            ));
        }

        completedSales.stream()
                .findFirst()
                .ifPresent(lastSale -> {
                    long inactiveDays = ChronoUnit.DAYS.between(lastSale.getSoldAt().toLocalDate(), today);
                    if (inactiveDays > 60) {
                        insights.add(insight(
                                "COMMERCIAL_REACTIVATION",
                                CustomerProfileInsightResponse.Severity.INFO,
                                "Cliente inativo",
                                "Cliente sem compras concluidas ha %d dia(s).".formatted(inactiveDays),
                                "Considere contato de reativacao com novidades ou condicao especial."
                        ));
                    }
                });

        if (customer.getBirthDate() != null && customer.getBirthDate().getMonth() == today.getMonth()) {
            insights.add(insight(
                    "BIRTHDAY_MONTH",
                    CustomerProfileInsightResponse.Severity.INFO,
                    "Aniversariante do mes",
                    "O aniversario do cliente acontece em %s.".formatted(formatDate(customer.getBirthDate())),
                    "Use uma abordagem de relacionamento ou oferta especial de aniversario."
            ));
        }

        if (customer.getCreditLimit() != null
                && customer.getCreditLimit().compareTo(BigDecimal.ZERO) > 0
                && openPromissoryAmount.compareTo(customer.getCreditLimit()) > 0) {
            insights.add(insight(
                    "CREDIT_LIMIT_EXCEEDED",
                    CustomerProfileInsightResponse.Severity.DANGER,
                    "Limite de credito excedido",
                    "Saldo aberto de R$ %s acima do limite cadastrado de R$ %s."
                            .formatted(formatMoney(openPromissoryAmount), formatMoney(customer.getCreditLimit())),
                    "Revise o limite antes de liberar novas compras a prazo."
            ));
        }

        if (completedSales.size() >= 4 || totalPurchasedAmount.compareTo(new BigDecimal("1500.00")) >= 0 || averageTicketAmount.compareTo(new BigDecimal("300.00")) >= 0) {
            insights.add(insight(
                    "HIGH_VALUE_CUSTOMER",
                    CustomerProfileInsightResponse.Severity.SUCCESS,
                    "Cliente de alto valor",
                    "Historico com %d compra(s), total de R$ %s e ticket medio de R$ %s."
                            .formatted(completedSales.size(), formatMoney(totalPurchasedAmount), formatMoney(averageTicketAmount)),
                    "Priorize atendimento consultivo e ofertas alinhadas ao perfil de compra."
            ));
        }

        if (insights.isEmpty()) {
            insights.add(insight(
                    "NO_HISTORY",
                    CustomerProfileInsightResponse.Severity.INFO,
                    "Sem historico suficiente",
                    "Ainda nao ha dados financeiros relevantes para classificar este cliente.",
                    "Mantenha cadastro completo para melhorar as proximas analises."
            ));
        }

        return insights;
    }

    private CustomerProfileInsightResponse insight(
            String code,
            CustomerProfileInsightResponse.Severity severity,
            String title,
            String message,
            String recommendedAction
    ) {
        return new CustomerProfileInsightResponse(code, severity, title, message, recommendedAction);
    }

    private CustomerPromissoryNoteResponse toCustomerPromissoryNoteResponse(PromissoryNote note) {
        PromissoryNoteResponse response = promissoryNoteMapper.toResponse(note);
        List<PromissoryNotePaymentResponse> payments = note.getPayments().stream()
                .sorted(Comparator.comparing(com.iwr.pdv.promissorynote.domain.PromissoryNotePayment::getPaidAt).reversed())
                .map(promissoryNoteMapper::toPaymentResponse)
                .toList();

        return new CustomerPromissoryNoteResponse(
                response.id(),
                response.saleId(),
                response.installmentNumber(),
                response.totalInstallments(),
                response.amount(),
                response.paidAmount(),
                response.remainingAmount(),
                response.updatedAmount(),
                response.daysOverdue(),
                response.dueDate(),
                response.status(),
                response.paidAt(),
                response.paidBy(),
                response.paymentMethod(),
                response.createdAt(),
                response.updatedAt(),
                response.saleItems(),
                payments
        );
    }

    private List<com.iwr.pdv.sale.api.dto.SaleResponse> filterSales(
            List<com.iwr.pdv.sale.api.dto.SaleResponse> sales,
            LocalDate startDate,
            LocalDate endDate,
            SaleStatus saleStatus
    ) {
        return sales.stream()
                .filter(sale -> saleStatus == null || sale.status() == saleStatus)
                .filter(sale -> startDate == null || !sale.soldAt().toLocalDate().isBefore(startDate))
                .filter(sale -> endDate == null || !sale.soldAt().toLocalDate().isAfter(endDate))
                .sorted(Comparator.comparing(com.iwr.pdv.sale.api.dto.SaleResponse::soldAt).reversed())
                .toList();
    }

    private List<CustomerPromissoryNoteResponse> filterNotes(
            List<CustomerPromissoryNoteResponse> notes,
            LocalDate startDate,
            LocalDate endDate,
            PromissoryNoteStatus noteStatus
    ) {
        return notes.stream()
                .filter(note -> noteStatus == null || note.status() == noteStatus)
                .filter(note -> startDate == null || !note.dueDate().isBefore(startDate))
                .filter(note -> endDate == null || !note.dueDate().isAfter(endDate))
                .sorted(Comparator.comparing(CustomerPromissoryNoteResponse::dueDate).reversed())
                .toList();
    }

    private String csvCell(String value) {
        if (value == null) {
            return "";
        }

        String safeValue = neutralizeCsvFormula(value);
        return "\"" + safeValue.replace("\"", "\"\"") + "\"";
    }

    private String neutralizeCsvFormula(String value) {
        String trimmed = value.stripLeading();
        if (trimmed.isEmpty()) {
            return value;
        }

        char firstCharacter = trimmed.charAt(0);
        if (firstCharacter == '=' || firstCharacter == '+' || firstCharacter == '-' || firstCharacter == '@') {
            return "'" + value;
        }

        return value;
    }

    private String formatMoney(BigDecimal value) {
        return value == null ? "0,00" : value.setScale(2, RoundingMode.HALF_UP).toPlainString().replace('.', ',');
    }

    private String formatDate(LocalDate value) {
        return value == null ? "" : DATE_FORMATTER.format(value);
    }

    private String formatDateTime(OffsetDateTime value) {
        return value == null ? "" : DATE_TIME_FORMATTER.format(value);
    }

    private String paymentMethodLabel(com.iwr.pdv.sale.domain.PaymentMethod paymentMethod) {
        if (paymentMethod == null) {
            return "";
        }

        return switch (paymentMethod) {
            case CASH -> "Dinheiro";
            case PIX -> "Pix";
            case DEBIT_CARD -> "Cartao de debito";
            case CREDIT_CARD -> "Cartao de credito";
            case PROMISSORY_NOTE -> "Nota promissoria";
        };
    }

    private String statusLabel(SaleStatus status) {
        return switch (status) {
            case COMPLETED -> "Concluida";
            case CANCELLED -> "Cancelada";
        };
    }

    private String statusLabel(PromissoryNoteStatus status) {
        return switch (status) {
            case PENDING -> "Pendente";
            case PARTIALLY_PAID -> "Parcialmente paga";
            case PAID -> "Paga";
            case OVERDUE -> "Vencida";
            case CANCELLED -> "Cancelada";
        };
    }

    private static class PurchasedItemAccumulator {
        private final Long productId;
        private final String productName;
        private final String productCode;
        private int quantity;
        private BigDecimal totalAmount = BigDecimal.ZERO;
        private OffsetDateTime lastPurchaseAt;

        PurchasedItemAccumulator(Long productId, String productName, String productCode) {
            this.productId = productId;
            this.productName = productName;
            this.productCode = productCode;
        }

        void add(SaleItem item, OffsetDateTime soldAt) {
            quantity += item.getQuantity();
            totalAmount = totalAmount.add(item.getSubtotal());
            if (lastPurchaseAt == null || soldAt.isAfter(lastPurchaseAt)) {
                lastPurchaseAt = soldAt;
            }
        }

        CustomerPurchasedItemResponse toResponse() {
            return new CustomerPurchasedItemResponse(
                    productId,
                    productName,
                    productCode,
                    quantity,
                    totalAmount,
                    lastPurchaseAt
            );
        }
    }
}
