package com.iwr.pdv.sale.application;

import com.iwr.pdv.audit.application.AuditLogService;
import com.iwr.pdv.audit.domain.AuditAction;
import com.iwr.pdv.auth.domain.AppUser;
import com.iwr.pdv.cash.application.CashRegisterService;
import com.iwr.pdv.cash.domain.CashRegister;
import com.iwr.pdv.common.exception.BusinessRuleException;
import com.iwr.pdv.common.exception.ResourceNotFoundException;
import com.iwr.pdv.customer.domain.Customer;
import com.iwr.pdv.customer.domain.CustomerRepository;
import com.iwr.pdv.product.domain.Product;
import com.iwr.pdv.product.domain.ProductRepository;
import com.iwr.pdv.promissorynote.api.dto.PromissoryInstallmentRequest;
import com.iwr.pdv.promissorynote.domain.PromissoryNote;
import com.iwr.pdv.promissorynote.domain.PromissoryNoteRepository;
import com.iwr.pdv.promissorynote.domain.PromissoryNoteStatus;
import com.iwr.pdv.sale.api.dto.SaleCancellationRequest;
import com.iwr.pdv.sale.api.dto.SaleItemRequest;
import com.iwr.pdv.sale.api.dto.SaleRequest;
import com.iwr.pdv.sale.api.dto.SaleResponse;
import com.iwr.pdv.sale.domain.PaymentMethod;
import com.iwr.pdv.sale.domain.Sale;
import com.iwr.pdv.sale.domain.SaleItem;
import com.iwr.pdv.sale.domain.SaleRepository;
import com.iwr.pdv.sale.domain.SaleStatus;
import com.iwr.pdv.sale.domain.StockMovement;
import com.iwr.pdv.sale.domain.StockMovementRepository;
import com.iwr.pdv.sale.domain.StockMovementType;
import com.iwr.pdv.sale.mapper.SaleMapper;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SaleServiceImpl implements SaleService {

    private static final String SALE_REFERENCE_TYPE = "SALE";
    private static final DateTimeFormatter RECEIPT_DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final SaleRepository saleRepository;
    private final ProductRepository productRepository;
    private final StockMovementRepository stockMovementRepository;
    private final CustomerRepository customerRepository;
    private final PromissoryNoteRepository promissoryNoteRepository;
    private final SaleMapper saleMapper;
    private final CashRegisterService cashRegisterService;
    private final AuditLogService auditLogService;
    private final Clock clock;

    public SaleServiceImpl(
            SaleRepository saleRepository,
            ProductRepository productRepository,
            StockMovementRepository stockMovementRepository,
            CustomerRepository customerRepository,
            PromissoryNoteRepository promissoryNoteRepository,
            SaleMapper saleMapper,
            CashRegisterService cashRegisterService,
            AuditLogService auditLogService,
            Clock clock
    ) {
        this.saleRepository = saleRepository;
        this.productRepository = productRepository;
        this.stockMovementRepository = stockMovementRepository;
        this.customerRepository = customerRepository;
        this.promissoryNoteRepository = promissoryNoteRepository;
        this.saleMapper = saleMapper;
        this.cashRegisterService = cashRegisterService;
        this.auditLogService = auditLogService;
        this.clock = clock;
    }

    @Override
    @Transactional
    public SaleResponse closeSale(SaleRequest request, AppUser operator) {
        Map<Long, Integer> quantitiesByProductId = consolidateQuantities(request.items());
        OffsetDateTime now = OffsetDateTime.now(clock);
        CashRegister cashRegister = cashRegisterService.requireOpenRegister();
        Customer customer = resolveCustomer(request);

        Sale sale = new Sale();
        sale.setSoldAt(now);
        sale.setCreatedAt(now);
        sale.setStatus(SaleStatus.COMPLETED);
        sale.setOperator(operator);
        sale.setCashRegister(cashRegister);
        sale.setCustomer(customer);
        sale.setPaymentMethod(request.paymentMethod());
        sale.setSubtotalAmount(BigDecimal.ZERO);
        sale.setDiscountAmount(resolveDiscount(request.discountAmount()));
        sale.setTotalAmount(BigDecimal.ZERO);
        sale.setChangeAmount(BigDecimal.ZERO);

        for (Map.Entry<Long, Integer> entry : quantitiesByProductId.entrySet()) {
            Product product = findProduct(entry.getKey());
            int quantity = entry.getValue();

            validateProductCanBeSold(product, quantity);
            product.setStockQuantity(product.getStockQuantity() - quantity);
            product.setUpdatedAt(now);

            SaleItem item = saleMapper.toItem(product, quantity);
            sale.addItem(item);
            sale.setSubtotalAmount(sale.getSubtotalAmount().add(item.getSubtotal()));
        }

        validateDiscount(sale.getSubtotalAmount(), sale.getDiscountAmount());
        sale.setTotalAmount(sale.getSubtotalAmount().subtract(sale.getDiscountAmount()));
        applyPaymentAmounts(sale, request.amountReceived());
        validatePromissoryInstallments(sale, request.promissoryInstallments());

        Sale savedSale = saleRepository.save(sale);
        if (savedSale.getPaymentMethod() == PaymentMethod.PROMISSORY_NOTE) {
            List<PromissoryNote> notes = buildPromissoryNotes(savedSale, customer, request.promissoryInstallments(), now);
            promissoryNoteRepository.saveAll(notes);
            notes.forEach(savedSale::addPromissoryNote);
        }
        stockMovementRepository.saveAll(savedSale.getItems()
                .stream()
                .map(item -> toStockMovement(item, savedSale.getId(), now, StockMovementType.SALE))
                .toList());

        return saleMapper.toResponse(savedSale);
    }

    @Override
    @Transactional
    public SaleResponse cancel(Long saleId, SaleCancellationRequest request, AppUser operator) {
        Sale sale = saleRepository.findById(saleId)
                .orElseThrow(() -> new ResourceNotFoundException("Sale not found for id " + saleId + "."));

        if (sale.getStatus() == SaleStatus.CANCELLED) {
            throw new BusinessRuleException("Sale is already cancelled.");
        }

        OffsetDateTime now = OffsetDateTime.now(clock);
        List<PromissoryNote> promissoryNotes = promissoryNoteRepository.findBySaleIdOrderByInstallmentNumberAsc(saleId);
        for (PromissoryNote note : promissoryNotes) {
            if (note.getStatus() == PromissoryNoteStatus.PAID) {
                cashRegisterService.registerReceivableReversal(
                        note.getAmount(),
                        note.getPaymentMethod(),
                        "Estorno de promissoria #" + note.getId() + " - cancelamento de venda",
                        operator,
                        "PROMISSORY_NOTE",
                        note.getId()
                );
            }
        }

        sale.setStatus(SaleStatus.CANCELLED);
        sale.setCancelledBy(operator);
        sale.setCancellationReason(request.reason().trim());
        sale.setCancelledAt(now);

        for (SaleItem item : sale.getItems()) {
            Product product = item.getProduct();
            product.setStockQuantity(product.getStockQuantity() + item.getQuantity());
            product.setUpdatedAt(now);
        }

        for (PromissoryNote note : promissoryNotes) {
            note.setStatus(PromissoryNoteStatus.CANCELLED);
            note.setUpdatedAt(now);
        }

        stockMovementRepository.saveAll(sale.getItems()
                .stream()
                .map(item -> toStockMovement(item, sale.getId(), now, StockMovementType.SALE_CANCELLATION))
                .toList());

        auditLogService.log(
                AuditAction.SALE_CANCELLED,
                operator,
                "SALE",
                sale.getId(),
                "Sale cancelled. Reason: " + request.reason().trim()
        );

        return saleMapper.toResponse(sale);
    }

    @Override
    @Transactional(readOnly = true)
    public List<SaleResponse> list(LocalDate startDate, LocalDate endDate) {
        if (startDate == null && endDate == null) {
            return saleRepository.findAllByOrderBySoldAtDesc()
                    .stream()
                    .map(saleMapper::toResponse)
                    .toList();
        }

        LocalDate resolvedStart = startDate == null ? LocalDate.of(1970, 1, 1) : startDate;
        LocalDate resolvedEnd = endDate == null ? LocalDate.now(clock) : endDate;

        OffsetDateTime start = OffsetDateTime.of(resolvedStart, LocalTime.MIN, clock.getZone().getRules().getOffset(OffsetDateTime.now(clock).toInstant()));
        OffsetDateTime end = OffsetDateTime.of(resolvedEnd, LocalTime.MAX, clock.getZone().getRules().getOffset(OffsetDateTime.now(clock).toInstant()));

        return saleRepository.findBySoldAtBetweenOrderBySoldAtDesc(start, end)
                .stream()
                .map(saleMapper::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public SaleResponse findById(Long saleId) {
        return saleMapper.toResponse(saleRepository.findById(saleId)
                .orElseThrow(() -> new ResourceNotFoundException("Sale not found for id " + saleId + ".")));
    }

    @Override
    @Transactional(readOnly = true)
    public String generateReceipt(Long saleId) {
        Sale sale = saleRepository.findById(saleId)
                .orElseThrow(() -> new ResourceNotFoundException("Sale not found for id " + saleId + "."));

        StringBuilder itemsHtml = new StringBuilder();
        for (SaleItem item : sale.getItems()) {
            itemsHtml.append("""
                    <article class="item-row">
                      <div class="item-main">
                        <strong>%s</strong>
                        <span>%s</span>
                      </div>
                      <div class="item-values">
                        <span>%d x %s</span>
                        <strong>%s</strong>
                      </div>
                    </article>
                    """.formatted(
                    escape(item.getProductName()),
                    escape(item.getProductCode()),
                    item.getQuantity(),
                    formatMoney(item.getUnitPrice()),
                    formatMoney(item.getSubtotal())
            ));
        }

        return """
                <!doctype html>
                <html lang="pt-BR">
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <title>Recibo Venda #%d</title>
                  <style>
                    :root{--ink:#111827;--muted:#6b7280;--line:#e5e7eb;--soft:#f8fafc;--dark:#121212}
                    *{box-sizing:border-box}
                    body{
                      margin:0;
                      padding:28px;
                      background:linear-gradient(135deg,#f9fafb,#eef2f7);
                      color:var(--ink);
                      font-family:"Segoe UI",Arial,sans-serif;
                    }
                    .receipt{
                      width:min(460px,100%%);
                      margin:0 auto;
                      background:#fff;
                      border:1px solid var(--line);
                      box-shadow:0 22px 70px rgba(15,23,42,.14);
                    }
                    .top{
                      padding:26px 26px 22px;
                      background:var(--dark);
                      color:#fff;
                    }
                    .brand-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
                    .brand{font-family:Georgia,serif;font-style:italic;font-size:34px;font-weight:700;line-height:1}
                    .badge{
                      border:1px solid rgba(255,255,255,.28);
                      padding:7px 10px;
                      color:rgba(255,255,255,.78);
                      font-size:10px;
                      font-weight:800;
                      letter-spacing:.12em;
                      text-transform:uppercase;
                    }
                    .top h1{margin:22px 0 8px;font-size:22px;line-height:1.1}
                    .top p{margin:0;color:rgba(255,255,255,.68);font-size:13px;line-height:1.55}
                    .content{padding:24px 26px 26px}
                    .meta-grid{
                      display:grid;
                      grid-template-columns:repeat(2,minmax(0,1fr));
                      gap:1px;
                      overflow:hidden;
                      border:1px solid var(--line);
                      background:var(--line);
                    }
                    .meta-card{padding:12px;background:var(--soft)}
                    .label{
                      display:block;
                      margin-bottom:5px;
                      color:var(--muted);
                      font-size:10px;
                      font-weight:800;
                      letter-spacing:.12em;
                      text-transform:uppercase;
                    }
                    .meta-card strong{font-size:13px}
                    .section-title{
                      margin:22px 0 10px;
                      color:var(--muted);
                      font-size:10px;
                      font-weight:900;
                      letter-spacing:.14em;
                      text-transform:uppercase;
                    }
                    .items{display:grid;border-top:1px dashed #cbd5e1}
                    .item-row{
                      display:grid;
                      grid-template-columns:minmax(0,1fr) auto;
                      gap:14px;
                      padding:13px 0;
                      border-bottom:1px dashed #cbd5e1;
                    }
                    .item-main{display:grid;gap:4px}
                    .item-main strong{font-size:14px;line-height:1.25}
                    .item-main span,.item-values span{color:var(--muted);font-size:11px;font-weight:800;text-transform:uppercase}
                    .item-values{display:grid;gap:4px;text-align:right}
                    .item-values strong{font-size:14px}
                    .totals{
                      display:grid;
                      gap:9px;
                      margin-top:18px;
                      padding:16px;
                      background:var(--soft);
                      border:1px solid var(--line);
                    }
                    .row{display:flex;justify-content:space-between;gap:16px;font-size:13px}
                    .row strong{text-align:right}
                    .total{
                      margin-top:4px;
                      padding-top:12px;
                      border-top:1px solid var(--line);
                      font-size:20px;
                      font-weight:900;
                    }
                    .total span{font-family:Georgia,serif;font-size:22px}
                    .status-note{
                      margin-top:16px;
                      padding:12px;
                      border-left:3px solid #dc2626;
                      background:#fef2f2;
                      color:#991b1b;
                      font-size:12px;
                      line-height:1.5;
                    }
                    .footer{
                      margin-top:20px;
                      padding-top:16px;
                      border-top:1px solid var(--line);
                      color:var(--muted);
                      text-align:center;
                      font-size:11px;
                      line-height:1.55;
                    }
                    button{
                      width:100%%;
                      margin-top:18px;
                      border:1px solid var(--dark);
                      background:var(--dark);
                      color:#fff;
                      padding:12px 16px;
                      font:inherit;
                      font-size:11px;
                      font-weight:900;
                      letter-spacing:.1em;
                      text-transform:uppercase;
                      cursor:pointer;
                    }
                    @page{size:80mm auto;margin:4mm}
                    @media print{
                      body{padding:0;background:#fff}
                      .receipt{width:100%%;max-width:none;border:0;box-shadow:none}
                      .top{padding:0 0 12px;background:#fff;color:var(--ink);border-bottom:1px dashed #111}
                      .badge{border-color:#111;color:#111}
                      .top p{color:#374151}
                      .content{padding:12px 0 0}
                      .meta-grid,.totals{border-color:#111;background:#fff}
                      .meta-card,.totals{background:#fff}
                      button{display:none}
                    }
                  </style>
                </head>
                <body>
                  <main class="receipt">
                    <header class="top">
                      <div class="brand-row">
                        <div class="brand">IWR.</div>
                        <div class="badge">Recibo nao fiscal</div>
                      </div>
                      <h1>Venda #%d</h1>
                      <p>Comprovante simples para controle interno e atendimento ao cliente.</p>
                    </header>
                    <section class="content">
                      <div class="meta-grid">
                        <div class="meta-card"><span class="label">Data</span><strong>%s</strong></div>
                        <div class="meta-card"><span class="label">Vendedor</span><strong>%s</strong></div>
                        <div class="meta-card"><span class="label">Status</span><strong>%s</strong></div>
                        <div class="meta-card"><span class="label">Pagamento</span><strong>%s</strong></div>
                      </div>
                    <h2 class="section-title">Itens vendidos</h2>
                    <section class="items">%s</section>
                    <section class="totals">
                      <div class="row"><span>Subtotal</span><strong>%s</strong></div>
                      <div class="row"><span>Desconto</span><strong>%s</strong></div>
                      <div class="row total"><span>Total</span><strong>%s</strong></div>
                      %s
                    </section>
                    %s
                    <footer class="footer">
                      <strong>Obrigado pela preferencia.</strong><br>
                      IWR Modas - Recibo sem valor fiscal.
                    </footer>
                    <button onclick="window.print()">Imprimir</button>
                    </section>
                  </main>
                </body>
                </html>
                """.formatted(
                sale.getId(),
                sale.getId(),
                formatDateTime(sale.getSoldAt()),
                escape(displayName(sale.getOperator())),
                statusLabel(sale.getStatus()),
                paymentLabel(sale.getPaymentMethod()),
                itemsHtml,
                formatMoney(sale.getSubtotalAmount()),
                formatMoney(sale.getDiscountAmount()),
                formatMoney(sale.getTotalAmount()),
                sale.getPaymentMethod() == PaymentMethod.CASH
                        ? "<div class=\"row\"><span>Recebido</span><strong>" + formatMoney(sale.getAmountReceived()) + "</strong></div><div class=\"row\"><span>Troco</span><strong>" + formatMoney(sale.getChangeAmount()) + "</strong></div>"
                        : "",
                sale.getStatus() == SaleStatus.CANCELLED
                        ? "<section class=\"status-note\"><strong>Venda cancelada</strong><br>Cancelada em " + formatDateTime(sale.getCancelledAt()) + "<br>Motivo: " + escape(sale.getCancellationReason()) + "</section>"
                        : ""
        );
    }

    private Map<Long, Integer> consolidateQuantities(List<SaleItemRequest> items) {
        Map<Long, Integer> quantitiesByProductId = new LinkedHashMap<>();

        for (SaleItemRequest item : items) {
            quantitiesByProductId.merge(item.productId(), item.quantity(), Integer::sum);
        }

        return quantitiesByProductId;
    }

    private Product findProduct(Long productId) {
        return productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found for id " + productId + "."));
    }

    private void validateProductCanBeSold(Product product, int quantity) {
        if (!Boolean.TRUE.equals(product.getActive())) {
            throw new BusinessRuleException("Product '" + product.getCode() + "' is inactive and cannot be sold.");
        }

        if (product.getStockQuantity() < quantity) {
            throw new BusinessRuleException(
                    "Product '" + product.getCode() + "' has insufficient stock. Available: "
                            + product.getStockQuantity() + "."
            );
        }
    }

    private BigDecimal resolveDiscount(BigDecimal discountAmount) {
        return discountAmount == null ? BigDecimal.ZERO : discountAmount;
    }

    private void validateDiscount(BigDecimal subtotalAmount, BigDecimal discountAmount) {
        if (discountAmount.compareTo(subtotalAmount) > 0) {
            throw new BusinessRuleException("Discount amount cannot be greater than sale subtotal.");
        }
    }

    private Customer resolveCustomer(SaleRequest request) {
        if (request.paymentMethod() != PaymentMethod.PROMISSORY_NOTE && request.customerId() == null) {
            return null;
        }

        if (request.customerId() == null) {
            throw new BusinessRuleException("Customer is required for promissory note sales.");
        }

        Customer customer = customerRepository.findById(request.customerId())
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found for id " + request.customerId() + "."));

        if (!Boolean.TRUE.equals(customer.getActive())) {
            throw new BusinessRuleException("Customer is inactive and cannot be used in a sale.");
        }

        return customer;
    }

    private void applyPaymentAmounts(Sale sale, BigDecimal amountReceived) {
        if (sale.getPaymentMethod() == PaymentMethod.CASH) {
            if (amountReceived == null || amountReceived.compareTo(sale.getTotalAmount()) < 0) {
                throw new BusinessRuleException("Cash received amount must be greater than or equal to sale total.");
            }
            sale.setAmountReceived(amountReceived);
            sale.setChangeAmount(amountReceived.subtract(sale.getTotalAmount()));
            return;
        }

        sale.setAmountReceived(null);
        sale.setChangeAmount(BigDecimal.ZERO);
    }

    private void validatePromissoryInstallments(Sale sale, List<PromissoryInstallmentRequest> installments) {
        if (sale.getPaymentMethod() != PaymentMethod.PROMISSORY_NOTE) {
            return;
        }

        if (installments == null || installments.isEmpty()) {
            throw new BusinessRuleException("At least one installment is required for promissory note sales.");
        }

        BigDecimal installmentTotal = installments.stream()
                .map(PromissoryInstallmentRequest::amount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (installmentTotal.compareTo(sale.getTotalAmount()) != 0) {
            throw new BusinessRuleException("Promissory note installments must match the sale total.");
        }
    }

    private List<PromissoryNote> buildPromissoryNotes(
            Sale sale,
            Customer customer,
            List<PromissoryInstallmentRequest> installments,
            OffsetDateTime createdAt
    ) {
        int totalInstallments = installments.size();
        return java.util.stream.IntStream.range(0, totalInstallments)
                .mapToObj(index -> {
                    PromissoryInstallmentRequest installment = installments.get(index);
                    PromissoryNote note = new PromissoryNote();
                    note.setSale(sale);
                    note.setCustomer(customer);
                    note.setInstallmentNumber(index + 1);
                    note.setTotalInstallments(totalInstallments);
                    note.setAmount(installment.amount());
                    note.setDueDate(installment.dueDate());
                    note.setStatus(PromissoryNoteStatus.PENDING);
                    note.setCreatedAt(createdAt);
                    note.setUpdatedAt(createdAt);
                    return note;
                })
                .toList();
    }

    private StockMovement toStockMovement(
            SaleItem item,
            Long saleId,
            OffsetDateTime createdAt,
            StockMovementType movementType
    ) {
        StockMovement movement = new StockMovement();
        movement.setProduct(item.getProduct());
        movement.setMovementType(movementType);
        movement.setQuantityChange(movementType == StockMovementType.SALE ? item.getQuantity() * -1 : item.getQuantity());
        movement.setReferenceType(SALE_REFERENCE_TYPE);
        movement.setReferenceId(saleId);
        movement.setCreatedAt(createdAt);

        return movement;
    }

    private String formatMoney(BigDecimal value) {
        return "R$ " + (value == null ? BigDecimal.ZERO : value).setScale(2).toString().replace(".", ",");
    }

    private String formatDateTime(OffsetDateTime value) {
        return value == null ? "" : RECEIPT_DATE_FORMATTER.format(value);
    }

    private String paymentLabel(PaymentMethod paymentMethod) {
        return switch (paymentMethod) {
            case CASH -> "Dinheiro";
            case PIX -> "PIX";
            case DEBIT_CARD -> "Cartao debito";
            case CREDIT_CARD -> "Cartao credito";
            case PROMISSORY_NOTE -> "Nota promissoria";
        };
    }

    private String statusLabel(SaleStatus status) {
        return status == SaleStatus.CANCELLED ? "Cancelada" : "Concluida";
    }

    private String displayName(AppUser operator) {
        if (operator == null || operator.getDisplayName() == null || operator.getDisplayName().isBlank()) {
            return "Vendedor";
        }

        return operator.getDisplayName();
    }

    private String escape(String value) {
        if (value == null) {
            return "";
        }

        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }
}
