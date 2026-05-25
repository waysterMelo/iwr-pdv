package com.iwr.pdv.promissorynote.application;

import com.iwr.pdv.audit.application.AuditLogService;
import com.iwr.pdv.audit.domain.AuditAction;
import com.iwr.pdv.auth.domain.AppUser;
import com.iwr.pdv.common.exception.BusinessRuleException;
import com.iwr.pdv.common.exception.ResourceNotFoundException;
import com.iwr.pdv.customer.domain.Customer;
import com.iwr.pdv.customer.domain.CustomerRepository;
import com.iwr.pdv.promissorynote.api.dto.PromissoryNoteCalendarDayResponse;
import com.iwr.pdv.promissorynote.api.dto.PromissoryNoteDelinquencyRangeResponse;
import com.iwr.pdv.promissorynote.api.dto.PromissoryNoteManualRequest;
import com.iwr.pdv.promissorynote.api.dto.PromissoryNotePaymentRequest;
import com.iwr.pdv.promissorynote.api.dto.PromissoryNotePaymentResponse;
import com.iwr.pdv.promissorynote.api.dto.PromissoryNoteResponse;
import com.iwr.pdv.promissorynote.domain.PromissoryNote;
import com.iwr.pdv.promissorynote.domain.PromissoryNotePayment;
import com.iwr.pdv.promissorynote.domain.PromissoryNotePaymentRepository;
import com.iwr.pdv.promissorynote.domain.PromissoryNoteRepository;
import com.iwr.pdv.promissorynote.domain.PromissoryNoteStatus;
import com.iwr.pdv.promissorynote.mapper.PromissoryNoteMapper;
import com.iwr.pdv.sale.domain.PaymentMethod;
import com.iwr.pdv.sale.domain.SaleItem;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PromissoryNoteServiceImpl implements PromissoryNoteService {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final BigDecimal PENALTY_RATE = new BigDecimal("0.02");
    private static final BigDecimal DAILY_INTEREST_RATE = new BigDecimal("0.003");
    private static final Set<PromissoryNoteStatus> OPEN_STATUSES = Set.of(
            PromissoryNoteStatus.PENDING,
            PromissoryNoteStatus.PARTIALLY_PAID,
            PromissoryNoteStatus.OVERDUE
    );

    private final PromissoryNoteRepository promissoryNoteRepository;
    private final CustomerRepository customerRepository;
    private final PromissoryNotePaymentRepository paymentRepository;
    private final PromissoryNoteMapper promissoryNoteMapper;
    private final AuditLogService auditLogService;
    private final Clock clock;

    public PromissoryNoteServiceImpl(
            PromissoryNoteRepository promissoryNoteRepository,
            CustomerRepository customerRepository,
            PromissoryNotePaymentRepository paymentRepository,
            PromissoryNoteMapper promissoryNoteMapper,
            AuditLogService auditLogService,
            Clock clock
    ) {
        this.promissoryNoteRepository = promissoryNoteRepository;
        this.customerRepository = customerRepository;
        this.paymentRepository = paymentRepository;
        this.promissoryNoteMapper = promissoryNoteMapper;
        this.auditLogService = auditLogService;
        this.clock = clock;
    }

    @Override
    @Transactional
    public List<PromissoryNoteResponse> list(
            PromissoryNoteStatus status,
            Long customerId,
            LocalDate startDate,
            LocalDate endDate
    ) {
        refreshOverdueStatuses();
        LocalDate start = startDate == null ? LocalDate.of(1970, 1, 1) : startDate;
        LocalDate end = endDate == null ? LocalDate.of(9999, 12, 31) : endDate;

        List<PromissoryNote> notes;
        if (customerId != null && status != null) {
            notes = promissoryNoteRepository.findByCustomerIdAndStatusAndDueDateBetweenOrderByDueDateAsc(customerId, status, start, end);
        } else if (customerId != null) {
            notes = promissoryNoteRepository.findByCustomerIdAndDueDateBetweenOrderByDueDateAsc(customerId, start, end);
        } else if (status != null) {
            notes = promissoryNoteRepository.findByStatusAndDueDateBetweenOrderByDueDateAsc(status, start, end);
        } else {
            notes = promissoryNoteRepository.findByDueDateBetweenOrderByDueDateAsc(start, end);
        }

        return notes.stream().map(promissoryNoteMapper::toResponse).toList();
    }

    @Override
    @Transactional
    public List<PromissoryNoteResponse> listDueToday() {
        refreshOverdueStatuses();
        LocalDate today = LocalDate.now(clock);
        return promissoryNoteRepository.findByStatusInAndDueDateLessThanEqualOrderByDueDateAsc(
                        List.of(PromissoryNoteStatus.PENDING, PromissoryNoteStatus.PARTIALLY_PAID, PromissoryNoteStatus.OVERDUE),
                        today
                )
                .stream()
                .map(promissoryNoteMapper::toResponse)
                .toList();
    }

    @Override
    @Transactional
    public List<PromissoryNoteCalendarDayResponse> calendarDays(LocalDate startDate, LocalDate endDate) {
        refreshOverdueStatuses();
        LocalDate start = startDate == null ? LocalDate.now(clock).withDayOfMonth(1) : startDate;
        LocalDate end = endDate == null ? start.withDayOfMonth(start.lengthOfMonth()) : endDate;
        Map<LocalDate, ReceivableDayTotal> totals = new LinkedHashMap<>();

        promissoryNoteRepository.findByStatusInAndDueDateBetweenOrderByDueDateAsc(
                        List.copyOf(OPEN_STATUSES),
                        start,
                        end
                )
                .forEach(note -> totals.computeIfAbsent(note.getDueDate(), ReceivableDayTotal::new)
                        .add(remainingAmount(note)));

        return totals.values()
                .stream()
                .sorted(Comparator.comparing(ReceivableDayTotal::date))
                .map(total -> new PromissoryNoteCalendarDayResponse(total.date(), total.amount(), total.count()))
                .toList();
    }

    @Override
    @Transactional
    public List<PromissoryNoteResponse> createManual(PromissoryNoteManualRequest request, AppUser operator) {
        Customer customer = customerRepository.findById(request.customerId())
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found for id " + request.customerId() + "."));
        if (!Boolean.TRUE.equals(customer.getActive())) {
            throw new BusinessRuleException("Customer is inactive.");
        }

        OffsetDateTime now = OffsetDateTime.now(clock);
        int totalInstallments = request.installments().size();
        List<PromissoryNote> notes = new java.util.ArrayList<>();
        for (int index = 0; index < request.installments().size(); index++) {
            PromissoryNoteManualRequest.Installment installment = request.installments().get(index);
            PromissoryNote note = new PromissoryNote();
            note.setSale(null);
            note.setCustomer(customer);
            note.setInstallmentNumber(index + 1);
            note.setTotalInstallments(totalInstallments);
            note.setAmount(money(installment.amount()));
            note.setPaidAmount(BigDecimal.ZERO);
            note.setDueDate(installment.dueDate());
            note.setStatus(installment.dueDate().isBefore(LocalDate.now(clock)) ? PromissoryNoteStatus.OVERDUE : PromissoryNoteStatus.PENDING);
            note.setCreatedAt(now);
            note.setUpdatedAt(now);
            notes.add(promissoryNoteRepository.save(note));
        }

        BigDecimal totalAmount = notes.stream().map(PromissoryNote::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        auditLogService.log(
                AuditAction.PROMISSORY_NOTE_CREATED,
                operator,
                "PROMISSORY_NOTE",
                notes.get(0).getId(),
                "Manual promissory notes created. Customer: " + customer.getId()
                        + ". Installments: " + totalInstallments + ". Amount: " + totalAmount + "."
        );

        return notes.stream().map(promissoryNoteMapper::toResponse).toList();
    }

    @Override
    @Transactional
    public PromissoryNoteResponse findById(Long noteId) {
        refreshOverdueStatuses();
        PromissoryNote note = findNote(noteId);
        return promissoryNoteMapper.toResponse(note);
    }

    @Override
    @Transactional
    public PromissoryNoteResponse pay(Long noteId, PromissoryNotePaymentRequest request, AppUser operator) {
        refreshOverdueStatuses();
        PromissoryNote note = findNote(noteId);

        if (note.getStatus() == PromissoryNoteStatus.PAID) {
            throw new BusinessRuleException("Promissory note is already paid.");
        }

        if (note.getStatus() == PromissoryNoteStatus.CANCELLED) {
            throw new BusinessRuleException("Promissory note is cancelled.");
        }


        if (request.paymentMethod() == PaymentMethod.PROMISSORY_NOTE) {
            throw new BusinessRuleException("Promissory note payment must be settled with cash, PIX, debit or credit.");
        }

        OffsetDateTime now = OffsetDateTime.now(clock);
        BigDecimal remainingAmount = remainingAmount(note);
        BigDecimal paymentAmount = request.amount() == null ? remainingAmount : money(request.amount());
        if (paymentAmount.compareTo(remainingAmount) > 0) {
            throw new BusinessRuleException("Payment amount cannot be greater than the remaining amount.");
        }

        Charges charges = Boolean.TRUE.equals(request.chargeInterestAndPenalty())
                ? calculateCharges(remainingAmount, note.getDueDate())
                : new Charges(BigDecimal.ZERO, BigDecimal.ZERO);
        BigDecimal totalReceived = paymentAmount.add(charges.penaltyAmount()).add(charges.interestAmount());

        PromissoryNotePayment payment = new PromissoryNotePayment();
        payment.setNote(note);
        payment.setAmount(paymentAmount);
        payment.setPenaltyAmount(charges.penaltyAmount());
        payment.setInterestAmount(charges.interestAmount());
        payment.setTotalReceived(totalReceived);
        payment.setPaymentMethod(request.paymentMethod());
        payment.setPaidBy(operator);
        payment.setPaidAt(now);
        paymentRepository.save(payment);

        BigDecimal paidAmount = paidAmount(note).add(paymentAmount);
        note.setPaidAmount(paidAmount);
        if (paidAmount.compareTo(note.getAmount()) >= 0) {
            note.setStatus(PromissoryNoteStatus.PAID);
            note.setPaidAt(now);
            note.setPaidBy(operator);
        } else {
            note.setStatus(PromissoryNoteStatus.PARTIALLY_PAID);
        }
        note.setPaymentMethod(request.paymentMethod());
        note.setUpdatedAt(now);

        auditLogService.log(
                AuditAction.PROMISSORY_NOTE_PAID,
                operator,
                "PROMISSORY_NOTE",
                note.getId(),
                "Promissory note payment with " + request.paymentMethod() + ". Amount: " + paymentAmount
                        + ". Remaining: " + remainingAmount(note) + "."
        );

        return promissoryNoteMapper.toResponse(note);
    }

    @Override
    @Transactional(readOnly = true)
    public List<PromissoryNotePaymentResponse> payments(Long noteId) {
        findNote(noteId);
        return paymentRepository.findByNoteIdOrderByPaidAtDesc(noteId)
                .stream()
                .map(promissoryNoteMapper::toPaymentResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public String generatePaymentReceipt(Long paymentId) {
        PromissoryNotePayment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new ResourceNotFoundException("Promissory note payment not found for id " + paymentId + "."));
        PromissoryNote note = payment.getNote();
        return """
                <!doctype html>
                <html lang="pt-BR"><head><meta charset="utf-8"><title>Recibo</title>
                <style>body{font-family:Arial,sans-serif;padding:28px;color:#111}.receipt{max-width:520px;margin:auto;border:1px solid #222;padding:24px}h1{font-size:22px;margin:0 0 18px}.row{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding:8px 0}.sign{margin-top:60px;text-align:center;border-top:1px solid #111;padding-top:8px}</style>
                </head><body><main class="receipt">
                <h1>Recibo de Pagamento de Promissoria</h1>
                <div class="row"><span>Nota</span><strong>#%d</strong></div>
                <div class="row"><span>Cliente</span><strong>%s</strong></div>
                <div class="row"><span>Valor da baixa</span><strong>%s</strong></div>
                <div class="row"><span>Juros/Multa</span><strong>%s</strong></div>
                <div class="row"><span>Total recebido</span><strong>%s</strong></div>
                <div class="row"><span>Forma</span><strong>%s</strong></div>
                <div class="row"><span>Data</span><strong>%s</strong></div>
                <div class="sign">%s</div>
                <button onclick="window.print()">Imprimir</button>
                </main></body></html>
                """.formatted(
                note.getId(),
                escape(note.getCustomer().getName()),
                formatMoney(payment.getAmount()),
                formatMoney(payment.getPenaltyAmount().add(payment.getInterestAmount())),
                formatMoney(payment.getTotalReceived()),
                payment.getPaymentMethod(),
                DATE_FORMATTER.format(payment.getPaidAt()),
                escape(payment.getPaidBy().getDisplayName())
        );
    }


    @Override
    @Transactional
    public String whatsappMessage(Long noteId, String pixKey) {
        refreshOverdueStatuses();
        PromissoryNote note = findNote(noteId);
        BigDecimal remaining = remainingAmount(note);
        long daysOverdue = Math.max(0, java.time.temporal.ChronoUnit.DAYS.between(note.getDueDate(), LocalDate.now(clock)));
        String pixLine = pixKey == null || pixKey.isBlank() ? "" : "%0AChave Pix: " + pixKey.trim();
        return "Ola, " + note.getCustomer().getName()
                + ". Consta uma parcela em aberto da IWR Modas no valor de " + formatMoney(remaining)
                + ", vencimento " + DATE_FORMATTER.format(note.getDueDate())
                + (daysOverdue > 0 ? ", em atraso ha " + daysOverdue + " dia(s)." : ".")
                + pixLine;
    }

    @Override
    @Transactional
    public List<PromissoryNoteDelinquencyRangeResponse> delinquencyReport() {
        refreshOverdueStatuses();
        LocalDate today = LocalDate.now(clock);
        Map<String, RangeTotal> totals = new LinkedHashMap<>();
        totals.put("Vence hoje", new RangeTotal());
        totals.put("1 a 7 dias vencido", new RangeTotal());
        totals.put("8 a 15 dias vencido", new RangeTotal());
        totals.put("16 a 30 dias vencido", new RangeTotal());
        totals.put("Acima de 30 dias", new RangeTotal());

        openNotesForReceivables().forEach(note -> {
            long days = java.time.temporal.ChronoUnit.DAYS.between(note.getDueDate(), today);
            String range = null;
            if (days == 0) range = "Vence hoje";
            if (days >= 1 && days <= 7) range = "1 a 7 dias vencido";
            if (days >= 8 && days <= 15) range = "8 a 15 dias vencido";
            if (days >= 16 && days <= 30) range = "16 a 30 dias vencido";
            if (days > 30) range = "Acima de 30 dias";
            if (range != null) {
                totals.get(range).add(remainingAmount(note));
            }
        });

        return totals.entrySet()
                .stream()
                .map(entry -> new PromissoryNoteDelinquencyRangeResponse(entry.getKey(), entry.getValue().amount(), entry.getValue().count()))
                .toList();
    }


    @Override
    @Transactional
    public String exportCsv(PromissoryNoteStatus status, Long customerId, LocalDate startDate, LocalDate endDate, boolean dueToday) {
        List<PromissoryNoteResponse> notes = dueToday ? listDueToday() : list(status, customerId, startDate, endDate);
        StringBuilder csv = new StringBuilder("Cliente;CPF;Venda;Parcela;Valor;Vencimento;Status;Pagamento\n");
        for (PromissoryNoteResponse note : notes) {
            csv.append(csvCell(note.customer().name())).append(';')
                    .append(csvCell(note.customer().cpf())).append(';')
                    .append(note.saleId() == null ? "Avulsa" : note.saleId()).append(';')
                    .append(note.installmentNumber()).append('/').append(note.totalInstallments()).append(';')
                    .append(formatMoney(note.amount())).append(';')
                    .append(DATE_FORMATTER.format(note.dueDate())).append(';')
                    .append(statusLabel(note.status())).append(';')
                    .append(note.paidAt() == null ? "" : DATE_FORMATTER.format(note.paidAt()))
                    .append('\n');
        }

        return csv.toString();
    }

    @Override
    @Transactional
    public String generatePrintableNote(Long noteId) {
        refreshOverdueStatuses();
        PromissoryNote note = findNote(noteId);
        
        return wrapHtml(generateNoteSection(note));
    }

    @Override
    @Transactional
    public String generatePrintableNotesForSale(Long saleId) {
        refreshOverdueStatuses();
        List<PromissoryNote> notes = promissoryNoteRepository.findBySaleIdOrderByInstallmentNumberAsc(saleId);
        
        if (notes.isEmpty()) {
            return "<html><body><p>Nenhuma nota promissoria encontrada para a venda.</p></body></html>";
        }
        
        StringBuilder sections = new StringBuilder();
        for (int i = 0; i < notes.size(); i++) {
            sections.append(generateNoteSection(notes.get(i)));
            if (i < notes.size() - 1) {
                sections.append("<div class=\"page-break\"></div>");
            }
        }
        
        return wrapHtml(sections.toString());
    }

    private String generateNoteSection(PromissoryNote note) {
        StringBuilder rows = new StringBuilder();
        List<SaleItem> items = note.getSale() == null
                ? List.of()
                : note.getSale().getItems()
                        .stream()
                        .sorted(Comparator.comparing(SaleItem::getId))
                        .toList();
        for (SaleItem item : items) {
            rows.append("""
                    <tr>
                      <td>%s</td>
                      <td>%d</td>
                      <td>%s</td>
                      <td>%s</td>
                    </tr>
                    """.formatted(
                    escape(item.getProductName()),
                    item.getQuantity(),
                    formatMoney(item.getUnitPrice()),
                    formatMoney(item.getSubtotal())
            ));
        }

        return """
                    <section class="note">
                      <aside class="stub">
                        <div>
                          <span>Canhoto</span>
                          <strong>#%d</strong>
                          <p>Parcela %d/%d</p>
                        </div>
                        <div class="vertical">Nota Promissoria</div>
                        <div>
                          <span>Valor</span>
                          <strong>%s</strong>
                          <p>Venc. %s</p>
                        </div>
                      </aside>
                      <section class="main">
                        <header class="top">
                          <div>
                            <div class="brand">IWR MODAS</div>
                            <div class="title">Nota Promissoria</div>
                            <div class="serial">Documento #%d - Parcela %d de %d</div>
                          </div>
                          <div class="amount-box">
                            <span>Valor</span>
                            <strong>%s</strong>
                          </div>
                        </header>
                      <p class="legal">Ao dia <strong>%s</strong>, pagarei por esta unica via de <strong>NOTA PROMISSORIA</strong> a <strong>IWR MODAS</strong>, ou a sua ordem, a quantia de <strong>%s</strong> em moeda corrente deste pais.</p>
                      <div class="field-grid">
                        <div class="field"><span>Emitente</span><strong>%s</strong></div>
                        <div class="field"><span>Documento</span><strong>%s</strong></div>
                        <div class="field"><span>Telefone</span><strong>%s</strong></div>
                        <div class="field"><span>Origem / Emissao</span><strong>%s - %s</strong></div>
                      </div>
                      <table>
                        <thead><tr><th>Produto</th><th>Qtd</th><th>Unitario</th><th>Total</th></tr></thead>
                        <tbody>%s</tbody>
                      </table>
                      <div class="field"><span>Status</span><strong>%s</strong></div>
                      <div class="signature">
                        <div class="place">Local e data: ________________________________</div>
                        <div class="line">%s</div>
                      </div>
                      <button class="no-print" onclick="window.print()">Imprimir</button>
                      </section>
                    </section>
                """.formatted(
                note.getId(),
                note.getInstallmentNumber(),
                note.getTotalInstallments(),
                formatMoney(note.getAmount()),
                DATE_FORMATTER.format(note.getDueDate()),
                note.getId(),
                note.getInstallmentNumber(),
                note.getTotalInstallments(),
                formatMoney(note.getAmount()),
                DATE_FORMATTER.format(note.getDueDate()),
                formatMoney(note.getAmount()),
                escape(note.getCustomer().getName()),
                note.getCustomer().getCpf() == null ? "Sem CPF" : escape(note.getCustomer().getCpf()),
                note.getCustomer().getPhone() == null ? "Sem telefone" : escape(note.getCustomer().getPhone()),
                note.getSale() == null ? "Nota avulsa" : "#" + note.getSale().getId(),
                DATE_FORMATTER.format(note.getCreatedAt()),
                rows,
                statusLabel(note.getStatus()),
                escape(note.getCustomer().getName())
        );
    }
    
    private String wrapHtml(String content) {
        return """
                <!doctype html>
                <html lang="pt-BR">
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <title>Notas Promissorias</title>
                  <style>
                    :root{--paper:#f3dc86;--paper-deep:#e6c96f;--ink:#1b1608;--muted:#5d4d22;--line:#7b6325}
                    *{box-sizing:border-box}
                    body{margin:0;padding:28px;background:#e8e0c7;color:var(--ink);font-family:"Courier New",Courier,monospace}
                    .sheet{width:min(980px,100%%);margin:0 auto}
                    .note{display:grid;grid-template-columns:150px minmax(0,1fr);min-height:520px;background:var(--paper);border:2px solid var(--line);box-shadow:0 24px 70px rgba(44,34,8,.28)}
                    .stub{display:grid;align-content:space-between;padding:18px 14px;border-right:2px dashed var(--line);background:linear-gradient(180deg,var(--paper-deep),var(--paper));font-size:12px}
                    .stub strong{display:block;margin-top:8px;font-size:18px}
                    .stub .vertical{writing-mode:vertical-rl;transform:rotate(180deg);justify-self:center;font-size:19px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}
                    .main{padding:22px 28px 26px}
                    .top{display:grid;grid-template-columns:minmax(0,1fr) 220px;gap:18px;align-items:start;border-bottom:2px solid var(--line);padding-bottom:14px}
                    .brand{font-family:Georgia,serif;font-size:34px;font-style:italic;font-weight:800;letter-spacing:.02em}
                    .title{margin-top:4px;font-size:24px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}
                    .serial{color:var(--muted);font-size:13px;font-weight:800;text-transform:uppercase}
                    .amount-box{padding:12px;border:2px solid var(--line);background:rgba(255,255,255,.22);text-align:center}
                    .amount-box span,.field span,.stub span{display:block;color:var(--muted);font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
                    .amount-box strong{display:block;margin-top:8px;font-size:28px}
                    .legal{margin:22px 0 16px;font-size:17px;line-height:2.05;text-align:justify}
                    .field-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:16px 0}
                    .field{min-height:58px;padding:9px 10px;border:1px solid var(--line);background:rgba(255,255,255,.18)}
                    .field strong{display:block;margin-top:7px;font-size:15px;line-height:1.25}
                    table{width:100%%;border-collapse:collapse;margin:18px 0 12px;background:rgba(255,255,255,.14)}
                    th,td{padding:8px 9px;border:1px solid rgba(123,99,37,.62);font-size:12px;text-align:left}
                    th{background:rgba(123,99,37,.16);font-size:10px;text-transform:uppercase;letter-spacing:.12em}
                    td:nth-child(n+2),th:nth-child(n+2){text-align:right}
                    .signature{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:22px;align-items:end;margin-top:54px}
                    .place{font-size:13px;color:var(--muted)}
                    .line{border-top:2px solid var(--ink);padding-top:9px;text-align:center;font-size:12px;text-transform:uppercase}
                    button{width:100%%;margin-top:18px;padding:14px;border:0;background:#1b1608;color:#fff;font-weight:900;letter-spacing:.12em;text-transform:uppercase;cursor:pointer}
                    .page-break { margin: 28px 0; }
                    @media print{
                        body{padding:0;background:#fff}
                        .sheet{width:100%%}
                        .note{box-shadow:none;min-height:auto}
                        .no-print{display:none}
                        .page-break { page-break-after: always; margin: 0; }
                    }
                  </style>
                </head>
                <body>
                  <main class="sheet">
                    %s
                  </main>
                </body>
                </html>
                """.formatted(content);
    }

    private PromissoryNote findNote(Long noteId) {
        return promissoryNoteRepository.findById(noteId)
                .orElseThrow(() -> new ResourceNotFoundException("Promissory note not found for id " + noteId + "."));
    }

    private List<PromissoryNote> openNotesForReceivables() {
        return promissoryNoteRepository.findAll()
                .stream()
                .filter(note -> note.getStatus() == PromissoryNoteStatus.PENDING
                        || note.getStatus() == PromissoryNoteStatus.PARTIALLY_PAID
                        || note.getStatus() == PromissoryNoteStatus.OVERDUE)
                .toList();
    }

    private void refreshOverdueStatuses() {
        LocalDate today = LocalDate.now(clock);
        OffsetDateTime now = OffsetDateTime.now(clock);
        promissoryNoteRepository.markPendingNotesOverdue(today, now);
    }

    private BigDecimal paidAmount(PromissoryNote note) {
        return note.getPaidAmount() == null ? BigDecimal.ZERO : note.getPaidAmount();
    }

    private BigDecimal remainingAmount(PromissoryNote note) {
        BigDecimal remaining = note.getAmount().subtract(paidAmount(note));
        return remaining.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : remaining.setScale(2, RoundingMode.HALF_UP);
    }

    private Charges calculateCharges(BigDecimal baseAmount, LocalDate dueDate) {
        LocalDate today = LocalDate.now(clock);
        if (!dueDate.isBefore(today)) {
            return new Charges(BigDecimal.ZERO, BigDecimal.ZERO);
        }

        long daysOverdue = java.time.temporal.ChronoUnit.DAYS.between(dueDate, today);
        BigDecimal penalty = baseAmount.multiply(PENALTY_RATE).setScale(2, RoundingMode.HALF_UP);
        BigDecimal interest = baseAmount
                .multiply(DAILY_INTEREST_RATE)
                .multiply(BigDecimal.valueOf(daysOverdue))
                .setScale(2, RoundingMode.HALF_UP);
        return new Charges(penalty, interest);
    }

    private BigDecimal money(BigDecimal value) {
        if (value == null) {
            return BigDecimal.ZERO;
        }

        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private String formatMoney(BigDecimal value) {
        return "R$ " + (value == null ? BigDecimal.ZERO : value).setScale(2).toString().replace(".", ",");
    }

    private String statusLabel(PromissoryNoteStatus status) {
        return switch (status) {
            case PENDING -> "Pendente";
            case PARTIALLY_PAID -> "Parcialmente pago";
            case PAID -> "Pago";
            case OVERDUE -> "Vencido";
            case CANCELLED -> "Cancelado";
        };
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

    private record Charges(BigDecimal penaltyAmount, BigDecimal interestAmount) {
    }

    private static class RangeTotal {
        private BigDecimal amount = BigDecimal.ZERO;
        private long count;

        void add(BigDecimal value) {
            amount = amount.add(value);
            count++;
        }

        BigDecimal amount() {
            return amount;
        }

        long count() {
            return count;
        }
    }

    private static class ReceivableDayTotal {
        private final LocalDate date;
        private BigDecimal amount = BigDecimal.ZERO;
        private long count;

        ReceivableDayTotal(LocalDate date) {
            this.date = date;
        }

        void add(BigDecimal value) {
            amount = amount.add(value);
            count++;
        }

        LocalDate date() {
            return date;
        }

        BigDecimal amount() {
            return amount;
        }

        long count() {
            return count;
        }
    }
}
