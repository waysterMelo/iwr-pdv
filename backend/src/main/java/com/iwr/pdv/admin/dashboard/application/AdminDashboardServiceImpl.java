package com.iwr.pdv.admin.dashboard.application;

import com.iwr.pdv.admin.dashboard.api.dto.AdminDashboardPaymentMethodResponse;
import com.iwr.pdv.admin.dashboard.api.dto.AdminDashboardReceivableDayResponse;
import com.iwr.pdv.admin.dashboard.api.dto.AdminDashboardReceivableResponse;
import com.iwr.pdv.admin.dashboard.api.dto.AdminDashboardReceivablesResponse;
import com.iwr.pdv.admin.dashboard.api.dto.AdminDashboardSummaryResponse;
import com.iwr.pdv.admin.dashboard.api.dto.AdminDashboardTopCustomerResponse;
import com.iwr.pdv.admin.dashboard.api.dto.AdminDashboardTopProductResponse;
import com.iwr.pdv.product.domain.ProductRepository;
import com.iwr.pdv.promissorynote.domain.PromissoryNote;
import com.iwr.pdv.promissorynote.domain.PromissoryNotePayment;
import com.iwr.pdv.promissorynote.domain.PromissoryNotePaymentRepository;
import com.iwr.pdv.promissorynote.domain.PromissoryNoteRepository;
import com.iwr.pdv.promissorynote.domain.PromissoryNoteStatus;
import com.iwr.pdv.sale.domain.PaymentMethod;
import com.iwr.pdv.sale.domain.Sale;
import com.iwr.pdv.sale.domain.SaleRepository;
import com.iwr.pdv.sale.domain.SaleStatus;
import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminDashboardServiceImpl implements AdminDashboardService {

    private static final NumberFormat CURRENCY_FORMAT = NumberFormat.getCurrencyInstance(new Locale("pt", "BR"));
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final List<PromissoryNoteStatus> OPEN_STATUSES = List.of(
            PromissoryNoteStatus.PENDING,
            PromissoryNoteStatus.PARTIALLY_PAID,
            PromissoryNoteStatus.OVERDUE
    );

    private final SaleRepository saleRepository;
    private final ProductRepository productRepository;
    private final PromissoryNoteRepository promissoryNoteRepository;
    private final PromissoryNotePaymentRepository promissoryNotePaymentRepository;
    private final Clock clock;

    public AdminDashboardServiceImpl(
            SaleRepository saleRepository,
            ProductRepository productRepository,
            PromissoryNoteRepository promissoryNoteRepository,
            PromissoryNotePaymentRepository promissoryNotePaymentRepository,
            Clock clock
    ) {
        this.saleRepository = saleRepository;
        this.productRepository = productRepository;
        this.promissoryNoteRepository = promissoryNoteRepository;
        this.promissoryNotePaymentRepository = promissoryNotePaymentRepository;
        this.clock = clock;
    }

    @Override
    @Transactional
    public AdminDashboardSummaryResponse summary(LocalDate startDate, LocalDate endDate) {
        Period period = resolvePeriod(startDate, endDate);
        List<Sale> completedSales = completedSales(period);
        List<PromissoryNotePayment> notePayments = notePayments(period);
        List<PromissoryNote> openNotes = openNotes();
        LocalDate today = LocalDate.now(clock);

        BigDecimal totalSold = sumSales(completedSales);
        BigDecimal totalReceived = sumReceivedSales(completedSales).add(sumNotePayments(notePayments));
        long saleCount = completedSales.size();

        long globalStockItems = productRepository.sumTotalStockQuantity();
        BigDecimal globalCostValue = productRepository.sumTotalCostValue();
        BigDecimal globalSaleValue = productRepository.sumTotalSaleValue();

        BigDecimal totalCMV = saleRepository.sumCMVForPeriod(period.start(), period.end());
        BigDecimal totalProfit = totalSold.subtract(totalCMV);

        List<AdminDashboardTopProductResponse> topProducts = saleRepository.findTopProductsForPeriod(
                period.start(),
                period.end(),
                PageRequest.of(0, 5)
        );

        return new AdminDashboardSummaryResponse(
                period.startDate(),
                period.endDate(),
                totalSold,
                totalReceived,
                sumSalesByMethod(completedSales, PaymentMethod.CASH),
                sumSalesByMethod(completedSales, PaymentMethod.PIX),
                sumSalesByMethod(completedSales, PaymentMethod.DEBIT_CARD),
                sumSalesByMethod(completedSales, PaymentMethod.CREDIT_CARD),
                sumSalesByMethod(completedSales, PaymentMethod.PROMISSORY_NOTE),
                saleCount,
                saleCount == 0 ? BigDecimal.ZERO : totalSold.divide(BigDecimal.valueOf(saleCount), 2, RoundingMode.HALF_UP),
                completedSales.stream().map(Sale::getDiscountAmount).reduce(BigDecimal.ZERO, BigDecimal::add),
                sumNotes(openNotes),
                sumOpenDueUntil(openNotes, today.minusDays(1)),
                sumOpenDueBetween(openNotes, today, today),
                sumOpenDueBetween(openNotes, today.plusDays(1), today.plusDays(7)),
                sumOpenDueBetween(openNotes, today.plusDays(1), today.plusDays(30)),
                globalStockItems,
                globalCostValue,
                globalSaleValue,
                totalCMV,
                totalProfit,
                topProducts
        );
    }

    @Override
    @Transactional(readOnly = true)
    public List<AdminDashboardPaymentMethodResponse> paymentMethods(LocalDate startDate, LocalDate endDate) {
        Period period = resolvePeriod(startDate, endDate);
        List<Sale> completedSales = completedSales(period);
        List<PromissoryNotePayment> notePayments = notePayments(period);

        return java.util.Arrays.stream(PaymentMethod.values())
                .map(method -> new AdminDashboardPaymentMethodResponse(
                        method,
                        sumSalesByMethod(completedSales, method),
                        sumReceivedByMethod(completedSales, notePayments, method),
                        completedSales.stream().filter(sale -> sale.getPaymentMethod() == method).count(),
                        method == PaymentMethod.PROMISSORY_NOTE
                                ? 0
                                : notePayments.stream().filter(payment -> payment.getPaymentMethod() == method).count()
                ))
                .toList();
    }

    @Override
    @Transactional
    public AdminDashboardReceivablesResponse receivables(
            LocalDate startDate,
            LocalDate endDate,
            LocalDate calendarStartDate,
            LocalDate calendarEndDate
    ) {
        Period period = resolvePeriod(startDate, endDate);
        Period calendarPeriod = resolvePeriod(calendarStartDate, calendarEndDate);
        List<PromissoryNote> openNotes = openNotes();
        LocalDate today = LocalDate.now(clock);
        List<PromissoryNote> periodNotes = openNotes.stream()
                .filter(note -> !note.getDueDate().isBefore(period.startDate()) && !note.getDueDate().isAfter(period.endDate()))
                .sorted(Comparator.comparing(PromissoryNote::getDueDate).thenComparing(PromissoryNote::getId))
                .toList();

        return new AdminDashboardReceivablesResponse(
                sumNotes(openNotes),
                sumOpenDueUntil(openNotes, today.minusDays(1)),
                sumOpenDueBetween(openNotes, today, today),
                sumOpenDueBetween(openNotes, today.plusDays(1), today.plusDays(7)),
                sumOpenDueBetween(openNotes, today.plusDays(1), today.plusDays(30)),
                topCustomers(openNotes),
                calendarDays(openNotes, calendarPeriod),
                periodNotes.stream().map(this::toReceivableResponse).toList()
        );
    }

    @Override
    @Transactional
    public byte[] report(LocalDate startDate, LocalDate endDate) {
        AdminDashboardSummaryResponse summary = summary(startDate, endDate);
        List<AdminDashboardPaymentMethodResponse> payments = paymentMethods(startDate, endDate);
        AdminDashboardReceivablesResponse receivables = receivables(startDate, endDate, startDate, endDate);
        Document document = new Document();
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        try {
            PdfWriter.getInstance(document, out);
            document.open();
            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18);
            Font subtitleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12);
            Font normalFont = FontFactory.getFont(FontFactory.HELVETICA, 9);
            Font boldFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9);

            Paragraph title = new Paragraph("Relatorio Administrativo", titleFont);
            title.setAlignment(Element.ALIGN_CENTER);
            title.setSpacingAfter(16);
            document.add(title);
            document.add(new Paragraph("Periodo: " + DATE_FORMAT.format(summary.startDate()) + " a " + DATE_FORMAT.format(summary.endDate()), normalFont));
            document.add(new Paragraph(" "));

            PdfPTable summaryTable = new PdfPTable(2);
            summaryTable.setWidthPercentage(100);
            addPair(summaryTable, "Total vendido", format(summary.totalSold()), boldFont, normalFont);
            addPair(summaryTable, "Total recebido", format(summary.totalReceived()), boldFont, normalFont);
            addPair(summaryTable, "Em aberto", format(summary.openReceivables()), boldFont, normalFont);
            addPair(summaryTable, "Vencido", format(summary.overdueReceivables()), boldFont, normalFont);
            addPair(summaryTable, "Quantidade de vendas", String.valueOf(summary.saleCount()), boldFont, normalFont);
            addPair(summaryTable, "Ticket medio", format(summary.averageTicket()), boldFont, normalFont);
            document.add(summaryTable);
            document.add(new Paragraph(" "));

            Paragraph paymentTitle = new Paragraph("Resumo por Forma de Pagamento", subtitleFont);
            paymentTitle.setSpacingAfter(8);
            document.add(paymentTitle);
            PdfPTable paymentTable = new PdfPTable(4);
            paymentTable.setWidthPercentage(100);
            addHeader(paymentTable, "Forma", boldFont);
            addHeader(paymentTable, "Vendido", boldFont);
            addHeader(paymentTable, "Recebido", boldFont);
            addHeader(paymentTable, "Vendas", boldFont);
            for (AdminDashboardPaymentMethodResponse payment : payments) {
                paymentTable.addCell(cell(label(payment.paymentMethod()), normalFont));
                paymentTable.addCell(right(format(payment.soldAmount()), normalFont));
                paymentTable.addCell(right(format(payment.receivedAmount()), normalFont));
                paymentTable.addCell(right(String.valueOf(payment.saleCount()), normalFont));
            }
            document.add(paymentTable);
            document.add(new Paragraph(" "));

            Paragraph receivableTitle = new Paragraph("Promissorias em Aberto", subtitleFont);
            receivableTitle.setSpacingAfter(8);
            document.add(receivableTitle);
            PdfPTable notesTable = new PdfPTable(5);
            notesTable.setWidthPercentage(100);
            addHeader(notesTable, "Cliente", boldFont);
            addHeader(notesTable, "Venda", boldFont);
            addHeader(notesTable, "Parcela", boldFont);
            addHeader(notesTable, "Vencimento", boldFont);
            addHeader(notesTable, "Valor", boldFont);
            for (AdminDashboardReceivableResponse item : receivables.items().stream().limit(30).toList()) {
                notesTable.addCell(cell(item.customerName(), normalFont));
                notesTable.addCell(cell(item.saleId() == null ? "Manual" : "#" + item.saleId(), normalFont));
                notesTable.addCell(cell(item.installmentNumber() + "/" + item.totalInstallments(), normalFont));
                notesTable.addCell(cell(DATE_FORMAT.format(item.dueDate()), normalFont));
                notesTable.addCell(right(format(item.amount()), normalFont));
            }
            document.add(notesTable);
        } catch (DocumentException exception) {
            throw new IllegalStateException("Could not generate admin dashboard report.", exception);
        } finally {
            document.close();
        }

        return out.toByteArray();
    }

    private List<Sale> completedSales(Period period) {
        return saleRepository.findBySoldAtBetweenOrderBySoldAtDesc(period.start(), period.end())
                .stream()
                .filter(sale -> sale.getStatus() == SaleStatus.COMPLETED)
                .toList();
    }

    private List<PromissoryNotePayment> notePayments(Period period) {
        return promissoryNotePaymentRepository.findAll()
                .stream()
                .filter(payment -> !payment.getPaidAt().isBefore(period.start()) && !payment.getPaidAt().isAfter(period.end()))
                .toList();
    }

    private List<PromissoryNote> openNotes() {
        LocalDate today = LocalDate.now(clock);
        promissoryNoteRepository.markPendingNotesOverdue(today, OffsetDateTime.now(clock));
        return promissoryNoteRepository.findAll()
                .stream()
                .filter(note -> OPEN_STATUSES.contains(note.getStatus()))
                .toList();
    }

    private List<AdminDashboardTopCustomerResponse> topCustomers(List<PromissoryNote> notes) {
        Map<Long, CustomerOpenAmount> totals = new LinkedHashMap<>();
        for (PromissoryNote note : notes) {
            Long customerId = note.getCustomer().getId();
            totals.computeIfAbsent(customerId, ignored -> new CustomerOpenAmount(customerId, note.getCustomer().getName()))
                    .add(remainingAmount(note));
        }

        return totals.values()
                .stream()
                .sorted(Comparator.comparing(CustomerOpenAmount::amount).reversed())
                .limit(5)
                .map(total -> new AdminDashboardTopCustomerResponse(total.customerId(), total.customerName(), total.amount(), total.count()))
                .toList();
    }

    private AdminDashboardReceivableResponse toReceivableResponse(PromissoryNote note) {
        Sale sale = note.getSale();
        Long saleId = sale == null ? null : sale.getId();

        return new AdminDashboardReceivableResponse(
                note.getId(),
                saleId,
                note.getCustomer().getName(),
                note.getInstallmentNumber(),
                note.getTotalInstallments(),
                remainingAmount(note),
                note.getDueDate(),
                note.getStatus(),
                note.getPaymentMethod(),
                note.getPaidAt()
        );
    }

    private List<AdminDashboardReceivableDayResponse> calendarDays(List<PromissoryNote> notes, Period calendarPeriod) {
        Map<LocalDate, ReceivableDayTotal> totals = new LinkedHashMap<>();
        for (PromissoryNote note : notes) {
            if (note.getDueDate().isBefore(calendarPeriod.startDate()) || note.getDueDate().isAfter(calendarPeriod.endDate())) {
                continue;
            }
            totals.computeIfAbsent(note.getDueDate(), ReceivableDayTotal::new)
                    .add(remainingAmount(note));
        }

        return totals.values()
                .stream()
                .sorted(Comparator.comparing(ReceivableDayTotal::date))
                .map(total -> new AdminDashboardReceivableDayResponse(total.date(), total.amount(), total.count()))
                .toList();
    }

    private BigDecimal sumSales(List<Sale> sales) {
        return sales.stream().map(Sale::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal sumReceivedSales(List<Sale> sales) {
        return sales.stream()
                .filter(sale -> sale.getPaymentMethod() != PaymentMethod.PROMISSORY_NOTE)
                .map(Sale::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal sumSalesByMethod(List<Sale> sales, PaymentMethod method) {
        return sales.stream()
                .filter(sale -> sale.getPaymentMethod() == method)
                .map(Sale::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal sumReceivedByMethod(List<Sale> sales, List<PromissoryNotePayment> notePayments, PaymentMethod method) {
        BigDecimal saleReceipts = method == PaymentMethod.PROMISSORY_NOTE
                ? BigDecimal.ZERO
                : sumSalesByMethod(sales, method);
        BigDecimal noteReceipts = notePayments.stream()
                .filter(payment -> payment.getPaymentMethod() == method)
                .map(PromissoryNotePayment::getTotalReceived)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return saleReceipts.add(noteReceipts);
    }

    private BigDecimal sumNotePayments(List<PromissoryNotePayment> notePayments) {
        return notePayments.stream().map(PromissoryNotePayment::getTotalReceived).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal sumNotes(List<PromissoryNote> notes) {
        return notes.stream().map(this::remainingAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal sumOpenDueUntil(List<PromissoryNote> notes, LocalDate end) {
        return notes.stream()
                .filter(note -> !note.getDueDate().isAfter(end))
                .map(this::remainingAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal sumOpenDueBetween(List<PromissoryNote> notes, LocalDate start, LocalDate end) {
        return notes.stream()
                .filter(note -> !note.getDueDate().isBefore(start) && !note.getDueDate().isAfter(end))
                .map(this::remainingAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal remainingAmount(PromissoryNote note) {
        BigDecimal paidAmount = note.getPaidAmount() == null ? BigDecimal.ZERO : note.getPaidAmount();
        return note.getAmount().subtract(paidAmount).max(BigDecimal.ZERO);
    }

    private Period resolvePeriod(LocalDate startDate, LocalDate endDate) {
        LocalDate today = LocalDate.now(clock);
        LocalDate start = startDate == null ? today : startDate;
        LocalDate end = endDate == null ? start : endDate;
        if (end.isBefore(start)) {
            end = start;
        }

        return new Period(
                start,
                end,
                OffsetDateTime.of(start, LocalTime.MIN, clock.getZone().getRules().getOffset(OffsetDateTime.now(clock).toInstant())),
                OffsetDateTime.of(end, LocalTime.MAX, clock.getZone().getRules().getOffset(OffsetDateTime.now(clock).toInstant()))
        );
    }

    private void addPair(PdfPTable table, String label, String value, Font boldFont, Font normalFont) {
        table.addCell(cell(label, boldFont));
        table.addCell(right(value, normalFont));
    }

    private void addHeader(PdfPTable table, String text, Font font) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setHorizontalAlignment(Element.ALIGN_CENTER);
        table.addCell(cell);
    }

    private PdfPCell cell(String text, Font font) {
        return new PdfPCell(new Phrase(text == null ? "-" : text, font));
    }

    private PdfPCell right(String text, Font font) {
        PdfPCell cell = cell(text, font);
        cell.setHorizontalAlignment(Element.ALIGN_RIGHT);
        return cell;
    }

    private String format(BigDecimal value) {
        return CURRENCY_FORMAT.format(value == null ? BigDecimal.ZERO : value);
    }

    private String label(PaymentMethod method) {
        return switch (method) {
            case CASH -> "Dinheiro";
            case PIX -> "Pix";
            case DEBIT_CARD -> "Cartao de debito";
            case CREDIT_CARD -> "Cartao de credito";
            case PROMISSORY_NOTE -> "Promissoria";
        };
    }

    private record Period(LocalDate startDate, LocalDate endDate, OffsetDateTime start, OffsetDateTime end) {
    }

    private static class CustomerOpenAmount {
        private final Long customerId;
        private final String customerName;
        private BigDecimal amount = BigDecimal.ZERO;
        private long count;

        CustomerOpenAmount(Long customerId, String customerName) {
            this.customerId = customerId;
            this.customerName = customerName;
        }

        void add(BigDecimal value) {
            amount = amount.add(value);
            count++;
        }

        Long customerId() {
            return customerId;
        }

        String customerName() {
            return customerName;
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
