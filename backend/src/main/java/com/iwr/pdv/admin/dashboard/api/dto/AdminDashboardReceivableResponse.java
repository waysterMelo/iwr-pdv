package com.iwr.pdv.admin.dashboard.api.dto;

import com.iwr.pdv.promissorynote.domain.PromissoryNoteStatus;
import com.iwr.pdv.sale.domain.PaymentMethod;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public record AdminDashboardReceivableResponse(
        Long noteId,
        Long saleId,
        String customerName,
        Integer installmentNumber,
        Integer totalInstallments,
        BigDecimal amount,
        LocalDate dueDate,
        PromissoryNoteStatus status,
        PaymentMethod paymentMethod,
        OffsetDateTime paidAt,
        Long cashRegisterId
) {
}
