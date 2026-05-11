package com.iwr.pdv.promissorynote.application;

import com.iwr.pdv.audit.application.AuditLogService;
import com.iwr.pdv.audit.domain.AuditAction;
import com.iwr.pdv.auth.domain.AppUser;
import com.iwr.pdv.cash.application.CashRegisterService;
import com.iwr.pdv.cash.domain.CashRegister;
import com.iwr.pdv.common.exception.BusinessRuleException;
import com.iwr.pdv.common.exception.ResourceNotFoundException;
import com.iwr.pdv.promissorynote.api.dto.PromissoryNotePaymentRequest;
import com.iwr.pdv.promissorynote.api.dto.PromissoryNoteResponse;
import com.iwr.pdv.promissorynote.domain.PromissoryNote;
import com.iwr.pdv.promissorynote.domain.PromissoryNoteRepository;
import com.iwr.pdv.promissorynote.domain.PromissoryNoteStatus;
import com.iwr.pdv.promissorynote.mapper.PromissoryNoteMapper;
import com.iwr.pdv.sale.domain.PaymentMethod;
import com.iwr.pdv.sale.domain.SaleItem;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PromissoryNoteServiceImpl implements PromissoryNoteService {

    private static final String PROMISSORY_REFERENCE_TYPE = "PROMISSORY_NOTE";
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final PromissoryNoteRepository promissoryNoteRepository;
    private final PromissoryNoteMapper promissoryNoteMapper;
    private final CashRegisterService cashRegisterService;
    private final AuditLogService auditLogService;
    private final Clock clock;

    public PromissoryNoteServiceImpl(
            PromissoryNoteRepository promissoryNoteRepository,
            PromissoryNoteMapper promissoryNoteMapper,
            CashRegisterService cashRegisterService,
            AuditLogService auditLogService,
            Clock clock
    ) {
        this.promissoryNoteRepository = promissoryNoteRepository;
        this.promissoryNoteMapper = promissoryNoteMapper;
        this.cashRegisterService = cashRegisterService;
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
                        List.of(PromissoryNoteStatus.PENDING, PromissoryNoteStatus.OVERDUE),
                        today
                )
                .stream()
                .map(promissoryNoteMapper::toResponse)
                .toList();
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
        CashRegister cashRegister = cashRegisterService.registerReceivablePayment(
                note.getAmount(),
                request.paymentMethod(),
                "Baixa de nota promissoria #" + note.getId(),
                operator,
                PROMISSORY_REFERENCE_TYPE,
                note.getId()
        );

        note.setStatus(PromissoryNoteStatus.PAID);
        note.setPaidAt(now);
        note.setPaidBy(operator);
        note.setPaymentMethod(request.paymentMethod());
        note.setCashRegister(cashRegister);
        note.setUpdatedAt(now);

        auditLogService.log(
                AuditAction.PROMISSORY_NOTE_PAID,
                operator,
                "PROMISSORY_NOTE",
                note.getId(),
                "Promissory note paid with " + request.paymentMethod() + ". Amount: " + note.getAmount() + "."
        );

        return promissoryNoteMapper.toResponse(note);
    }

    @Override
    @Transactional
    public String exportCsv(PromissoryNoteStatus status, Long customerId, LocalDate startDate, LocalDate endDate, boolean dueToday) {
        List<PromissoryNoteResponse> notes = dueToday ? listDueToday() : list(status, customerId, startDate, endDate);
        StringBuilder csv = new StringBuilder("Cliente;CPF;Venda;Parcela;Valor;Vencimento;Status;Pagamento\n");
        for (PromissoryNoteResponse note : notes) {
            csv.append(csvCell(note.customer().name())).append(';')
                    .append(csvCell(note.customer().cpf())).append(';')
                    .append(note.saleId()).append(';')
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
        List<SaleItem> items = note.getSale().getItems()
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
                        <div class="field"><span>Venda / Emissao</span><strong>#%d - %s</strong></div>
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
                note.getSale().getId(),
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

    private void refreshOverdueStatuses() {
        LocalDate today = LocalDate.now(clock);
        OffsetDateTime now = OffsetDateTime.now(clock);
        promissoryNoteRepository.markPendingNotesOverdue(today, now);
    }

    private String formatMoney(BigDecimal value) {
        return "R$ " + (value == null ? BigDecimal.ZERO : value).setScale(2).toString().replace(".", ",");
    }

    private String statusLabel(PromissoryNoteStatus status) {
        return switch (status) {
            case PENDING -> "Pendente";
            case PAID -> "Pago";
            case OVERDUE -> "Vencido";
            case CANCELLED -> "Cancelado";
        };
    }

    private String csvCell(String value) {
        if (value == null) {
            return "";
        }

        return "\"" + value.replace("\"", "\"\"") + "\"";
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
