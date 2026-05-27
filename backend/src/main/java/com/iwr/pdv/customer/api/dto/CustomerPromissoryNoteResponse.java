package com.iwr.pdv.customer.api.dto;

import com.iwr.pdv.auth.api.dto.UserResponse;
import com.iwr.pdv.promissorynote.api.dto.PromissoryNotePaymentResponse;
import com.iwr.pdv.promissorynote.domain.PromissoryNoteStatus;
import com.iwr.pdv.sale.api.dto.SaleItemResponse;
import com.iwr.pdv.sale.domain.PaymentMethod;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public record CustomerPromissoryNoteResponse(
        Long id,
        Long saleId,
        Integer installmentNumber,
        Integer totalInstallments,
        BigDecimal amount,
        BigDecimal paidAmount,
        BigDecimal remainingAmount,
        BigDecimal updatedAmount,
        long daysOverdue,
        LocalDate dueDate,
        PromissoryNoteStatus status,
        OffsetDateTime paidAt,
        UserResponse paidBy,
        PaymentMethod paymentMethod,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        List<SaleItemResponse> saleItems,
        List<PromissoryNotePaymentResponse> payments
) {
}
