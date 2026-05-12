package com.iwr.pdv.cash.application;

import com.iwr.pdv.cash.api.dto.CashRegisterResponse;
import com.iwr.pdv.cash.api.dto.CashMovementResponse;
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
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

@Service
public class CashRegisterReportService {

    private static final NumberFormat CURRENCY_FORMAT = NumberFormat.getCurrencyInstance(new Locale("pt", "BR"));
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");

    public byte[] generateReport(CashRegisterResponse cashRegister) {
        Document document = new Document();
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        try {
            PdfWriter.getInstance(document, out);
            document.open();

            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18);
            Font subtitleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12);
            Font normalFont = FontFactory.getFont(FontFactory.HELVETICA, 10);
            Font boldFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10);

            // Title
            Paragraph title = new Paragraph("Relatorio de Fechamento de Caixa", titleFont);
            title.setAlignment(Element.ALIGN_CENTER);
            title.setSpacingAfter(20);
            document.add(title);

            // Header Info
            String status = cashRegister.status() != null ? (cashRegister.status().name().equals("OPEN") ? "Aberto" : "Fechado") : "Desconhecido";
            document.add(new Paragraph("Status: " + status, normalFont));
            document.add(new Paragraph("Abertura: " + (cashRegister.openedAt() != null ? cashRegister.openedAt().format(DATE_FORMAT) : "-"), normalFont));
            document.add(new Paragraph("Operador Abertura: " + (cashRegister.openedBy() != null ? cashRegister.openedBy().displayName() : "-"), normalFont));
            if (cashRegister.closedAt() != null) {
                document.add(new Paragraph("Fechamento: " + cashRegister.closedAt().format(DATE_FORMAT), normalFont));
                document.add(new Paragraph("Operador Fechamento: " + (cashRegister.closedBy() != null ? cashRegister.closedBy().displayName() : "-"), normalFont));
            }
            if (cashRegister.reopenedAt() != null) {
                document.add(new Paragraph("Reabertura: " + cashRegister.reopenedAt().format(DATE_FORMAT), normalFont));
                document.add(new Paragraph("Operador Reabertura: " + (cashRegister.reopenedBy() != null ? cashRegister.reopenedBy().displayName() : "-"), normalFont));
                document.add(new Paragraph("Motivo Reabertura: " + valueOrDash(cashRegister.reopenReason()), normalFont));
            }
            
            document.add(new Paragraph(" ")); // spacer

            // Balances Table
            Paragraph balanceTitle = new Paragraph("Saldos do Caixa", subtitleFont);
            balanceTitle.setSpacingAfter(10);
            document.add(balanceTitle);

            PdfPTable balanceTable = new PdfPTable(2);
            balanceTable.setWidthPercentage(100);
            balanceTable.addCell(createCell("Saldo em Dinheiro na Abertura", boldFont));
            balanceTable.addCell(createRightCell(formatCurrency(cashRegister.openingAmount()), normalFont));
            
            balanceTable.addCell(createCell("Total Vendido (Todas as Formas)", boldFont));
            balanceTable.addCell(createRightCell(formatCurrency(cashRegister.totalSalesAmount()), normalFont));
            
            balanceTable.addCell(createCell("Total Vendido em Dinheiro", boldFont));
            balanceTable.addCell(createRightCell(formatCurrency(cashRegister.cashSalesAmount()), normalFont));

            balanceTable.addCell(createCell("Total de Suprimentos (+)", boldFont));
            balanceTable.addCell(createRightCell(formatCurrency(cashRegister.cashInAmount()), normalFont));

            balanceTable.addCell(createCell("Total de Sangrias (-)", boldFont));
            balanceTable.addCell(createRightCell(formatCurrency(cashRegister.cashOutAmount()), normalFont));

            balanceTable.addCell(createCell("Dinheiro Esperado na Gaveta", boldFont));
            balanceTable.addCell(createRightCell(formatCurrency(cashRegister.expectedCashAmount()), normalFont));
            
            if (cashRegister.status() != null && cashRegister.status().name().equals("CLOSED")) {
                balanceTable.addCell(createCell("Dinheiro Informado no Fechamento", boldFont));
                balanceTable.addCell(createRightCell(formatCurrency(cashRegister.declaredCashAmount()), normalFont));
                
                balanceTable.addCell(createCell("Diferenca (Quebra de Caixa)", boldFont));
                balanceTable.addCell(createRightCell(formatCurrency(cashRegister.cashDifference()), normalFont));

                if (cashRegister.cashDifference() != null && cashRegister.cashDifference().compareTo(BigDecimal.ZERO) != 0) {
                    balanceTable.addCell(createCell("Motivo da Diferenca", boldFont));
                    balanceTable.addCell(createCell(valueOrDash(cashRegister.closingDifferenceReason()), normalFont));
                }
            }

            document.add(balanceTable);
            document.add(new Paragraph(" "));

            // Totals by Payment Method
            if (cashRegister.totalsByPaymentMethod() != null && !cashRegister.totalsByPaymentMethod().isEmpty()) {
                Paragraph paymentTitle = new Paragraph("Resumo por Forma de Pagamento", subtitleFont);
                paymentTitle.setSpacingAfter(10);
                document.add(paymentTitle);

                PdfPTable paymentTable = new PdfPTable(2);
                paymentTable.setWidthPercentage(100);
                
                cashRegister.totalsByPaymentMethod().forEach((method, amount) -> {
                    paymentTable.addCell(createCell(translatePaymentMethod(method), normalFont));
                    paymentTable.addCell(createRightCell(formatCurrency(amount), normalFont));
                });
                
                document.add(paymentTable);
                document.add(new Paragraph(" "));
            }

            if (cashRegister.sales() != null && !cashRegister.sales().isEmpty()) {
                Paragraph salesTitle = new Paragraph("Vendas Vinculadas", subtitleFont);
                salesTitle.setSpacingAfter(10);
                document.add(salesTitle);

                PdfPTable salesTable = new PdfPTable(5);
                salesTable.setWidthPercentage(100);
                salesTable.setWidths(new float[]{1f, 2f, 1.5f, 1f, 1.5f});

                salesTable.addCell(createHeaderCell("Venda", boldFont));
                salesTable.addCell(createHeaderCell("Data/Hora", boldFont));
                salesTable.addCell(createHeaderCell("Pagamento", boldFont));
                salesTable.addCell(createHeaderCell("Itens", boldFont));
                salesTable.addCell(createHeaderCell("Total", boldFont));

                for (com.iwr.pdv.sale.api.dto.SaleResponse sale : cashRegister.sales()) {
                    salesTable.addCell(createCell("#" + sale.id(), normalFont));
                    salesTable.addCell(createCell(sale.soldAt().format(DATE_FORMAT), normalFont));
                    salesTable.addCell(createCell(translatePaymentMethod(sale.paymentMethod().name()), normalFont));
                    salesTable.addCell(createRightCell(String.valueOf(sale.totalItems()), normalFont));
                    salesTable.addCell(createRightCell(formatCurrency(sale.totalAmount()), normalFont));
                }

                document.add(salesTable);
                document.add(new Paragraph(" "));
            }

            // Movements
            if (cashRegister.movements() != null && !cashRegister.movements().isEmpty()) {
                Paragraph movementsTitle = new Paragraph("Movimentacoes (Sangrias e Suprimentos)", subtitleFont);
                movementsTitle.setSpacingAfter(10);
                document.add(movementsTitle);

                PdfPTable movementsTable = new PdfPTable(4);
                movementsTable.setWidthPercentage(100);
                movementsTable.setWidths(new float[]{1.5f, 3f, 1f, 1.5f});
                
                movementsTable.addCell(createHeaderCell("Data/Hora", boldFont));
                movementsTable.addCell(createHeaderCell("Motivo", boldFont));
                movementsTable.addCell(createHeaderCell("Tipo", boldFont));
                movementsTable.addCell(createHeaderCell("Valor", boldFont));

                for (CashMovementResponse m : cashRegister.movements()) {
                    movementsTable.addCell(createCell(m.createdAt().format(DATE_FORMAT), normalFont));
                    movementsTable.addCell(createCell(m.reason(), normalFont));
                    movementsTable.addCell(createCell(m.type().name().equals("CASH_IN") ? "Suprimento" : "Sangria", normalFont));
                    movementsTable.addCell(createRightCell(formatCurrency(m.amount()), normalFont));
                }

                document.add(movementsTable);
            }

            document.close();
        } catch (DocumentException e) {
            throw new RuntimeException("Erro ao gerar relatorio PDF", e);
        }

        return out.toByteArray();
    }

    private String formatCurrency(BigDecimal value) {
        if (value == null) return CURRENCY_FORMAT.format(BigDecimal.ZERO);
        return CURRENCY_FORMAT.format(value);
    }

    private String valueOrDash(String value) {
        return value == null || value.isBlank() ? "-" : value;
    }
    
    private String translatePaymentMethod(String method) {
        if (method == null) return "Desconhecido";
        return switch (method) {
            case "CASH" -> "Dinheiro";
            case "PIX" -> "Pix";
            case "CREDIT_CARD" -> "Cartao de Credito";
            case "DEBIT_CARD" -> "Cartao de Debito";
            case "PROMISSORY_NOTE" -> "Nota Promissoria";
            default -> method;
        };
    }

    private PdfPCell createCell(String content, Font font) {
        PdfPCell cell = new PdfPCell(new Phrase(content, font));
        cell.setPadding(5);
        cell.setBorderColor(new java.awt.Color(200, 200, 200));
        return cell;
    }
    
    private PdfPCell createRightCell(String content, Font font) {
        PdfPCell cell = createCell(content, font);
        cell.setHorizontalAlignment(Element.ALIGN_RIGHT);
        return cell;
    }

    private PdfPCell createHeaderCell(String content, Font font) {
        PdfPCell cell = createCell(content, font);
        cell.setBackgroundColor(new java.awt.Color(240, 240, 240));
        return cell;
    }
}
