package com.iwr.pdv.promissorynote.api.dto;

import com.iwr.pdv.auth.api.dto.UserResponse;
import com.iwr.pdv.sale.domain.PaymentMethod;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record PromissoryNotePaymentResponse(
        Long id,
        BigDecimal amount,
        BigDecimal penaltyAmount,
        BigDecimal interestAmount,
        BigDecimal totalReceived,
        PaymentMethod paymentMethod,
        UserResponse paidBy,
        OffsetDateTime paidAt
) {
}
