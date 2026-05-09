package com.iwr.pdv.promissorynote.application;

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
    private final Clock clock;

    public PromissoryNoteServiceImpl(
            PromissoryNoteRepository promissoryNoteRepository,
            PromissoryNoteMapper promissoryNoteMapper,
            CashRegisterService cashRegisterService,
            Clock clock
    ) {
        this.promissoryNoteRepository = promissoryNoteRepository;
        this.promissoryNoteMapper = promissoryNoteMapper;
        this.cashRegisterService = cashRegisterService;
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

        refreshOverdueStatus(notes);
        return notes.stream().map(promissoryNoteMapper::toResponse).toList();
    }

    @Override
    @Transactional
    public PromissoryNoteResponse findById(Long noteId) {
        PromissoryNote note = findNote(noteId);
        refreshOverdueStatus(List.of(note));
        return promissoryNoteMapper.toResponse(note);
    }

    @Override
    @Transactional
    public PromissoryNoteResponse pay(Long noteId, PromissoryNotePaymentRequest request, AppUser operator) {
        PromissoryNote note = findNote(noteId);
        refreshOverdueStatus(List.of(note));

        if (note.getStatus() == PromissoryNoteStatus.PAID) {
            throw new BusinessRuleException("Promissory note is already paid.");
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

        return promissoryNoteMapper.toResponse(note);
    }

    @Override
    @Transactional
    public String exportCsv(PromissoryNoteStatus status, Long customerId, LocalDate startDate, LocalDate endDate) {
        List<PromissoryNoteResponse> notes = list(status, customerId, startDate, endDate);
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
        PromissoryNote note = findNote(noteId);
        refreshOverdueStatus(List.of(note));

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
                <!doctype html>
                <html lang="pt-BR">
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <title>Nota Promissoria #%d</title>
                  <style>
                    :root{--ink:#111;--muted:#555;--line:#ddd;--soft:#f5f5f5}
                    *{box-sizing:border-box}
                    body{margin:0;padding:32px;background:#f3f4f6;color:var(--ink);font-family:"Segoe UI",Arial,sans-serif}
                    .note{width:min(860px,100%%);margin:0 auto;background:#fff;border:1px solid var(--line);box-shadow:0 24px 80px rgba(0,0,0,.14)}
                    header{display:flex;justify-content:space-between;gap:24px;padding:36px;border-bottom:2px solid #111}
                    .brand{font-family:Georgia,serif;font-style:italic;font-size:42px;font-weight:700}
                    .meta{text-align:right}.meta strong{display:block;font-size:34px}.meta span{color:var(--muted);font-size:13px}
                    .content{padding:36px}.legal{font-size:16px;line-height:2;text-align:justify}
                    table{width:100%%;border-collapse:collapse;margin:28px 0}th,td{padding:12px;border-bottom:1px solid var(--line);text-align:left}th{background:var(--soft);font-size:11px;text-transform:uppercase;letter-spacing:.12em}td:nth-child(n+2),th:nth-child(n+2){text-align:right}
                    .box{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:26px 0;padding:20px;border:1px dashed #aaa}.label{display:block;color:var(--muted);font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
                    .signature{display:flex;justify-content:flex-end;margin-top:70px}.line{width:280px;border-top:1px solid #111;text-align:center;padding-top:10px;font-size:12px;text-transform:uppercase}
                    button{width:100%%;margin-top:24px;padding:14px;border:0;background:#111;color:#fff;font-weight:800;text-transform:uppercase;cursor:pointer}
                    @media print{body{padding:0;background:#fff}.note{box-shadow:none;border:0}button{display:none}}
                  </style>
                </head>
                <body>
                  <main class="note">
                    <header>
                      <div>
                        <div class="brand">IWR.</div>
                        <strong>Nota Promissoria</strong>
                        <p>#%d - Parcela %d de %d</p>
                      </div>
                      <div class="meta">
                        <strong>%s</strong>
                        <span>Vencimento %s</span>
                      </div>
                    </header>
                    <section class="content">
                      <p class="legal">Ao dia <strong>%s</strong>, pagarei por esta unica via de <strong>NOTA PROMISSORIA</strong> a <strong>IWR MODAS</strong>, ou a sua ordem, a quantia de <strong>%s</strong> em moeda corrente deste pais.</p>
                      <table>
                        <thead><tr><th>Produto</th><th>Qtd</th><th>Unitario</th><th>Total</th></tr></thead>
                        <tbody>%s</tbody>
                      </table>
                      <div class="box">
                        <div><span class="label">Emitente</span><strong>%s</strong><br>%s<br>%s</div>
                        <div><span class="label">Venda</span><strong>#%d</strong><br>Emissao %s<br>Status %s</div>
                      </div>
                      <div class="signature"><div class="line">%s</div></div>
                      <button onclick="window.print()">Imprimir nota</button>
                    </section>
                  </main>
                </body>
                </html>
                """.formatted(
                note.getId(),
                note.getId(),
                note.getInstallmentNumber(),
                note.getTotalInstallments(),
                formatMoney(note.getAmount()),
                DATE_FORMATTER.format(note.getDueDate()),
                DATE_FORMATTER.format(note.getDueDate()),
                formatMoney(note.getAmount()),
                rows,
                escape(note.getCustomer().getName()),
                note.getCustomer().getCpf() == null ? "" : "CPF: " + escape(note.getCustomer().getCpf()),
                note.getCustomer().getPhone() == null ? "" : "Telefone: " + escape(note.getCustomer().getPhone()),
                note.getSale().getId(),
                DATE_FORMATTER.format(note.getCreatedAt()),
                statusLabel(note.getStatus()),
                escape(note.getCustomer().getName())
        );
    }

    private PromissoryNote findNote(Long noteId) {
        return promissoryNoteRepository.findById(noteId)
                .orElseThrow(() -> new ResourceNotFoundException("Promissory note not found for id " + noteId + "."));
    }

    private void refreshOverdueStatus(List<PromissoryNote> notes) {
        LocalDate today = LocalDate.now(clock);
        OffsetDateTime now = OffsetDateTime.now(clock);
        for (PromissoryNote note : notes) {
            if (note.getStatus() == PromissoryNoteStatus.PENDING && note.getDueDate().isBefore(today)) {
                note.setStatus(PromissoryNoteStatus.OVERDUE);
                note.setUpdatedAt(now);
            }
        }
    }

    private String formatMoney(BigDecimal value) {
        return "R$ " + (value == null ? BigDecimal.ZERO : value).setScale(2).toString().replace(".", ",");
    }

    private String statusLabel(PromissoryNoteStatus status) {
        return switch (status) {
            case PENDING -> "Pendente";
            case PAID -> "Pago";
            case OVERDUE -> "Vencido";
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
