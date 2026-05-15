package com.iwr.pdv.promissorynote.api.dto;

import com.iwr.pdv.sale.domain.PaymentMethod;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record PromissoryNotePaymentRequest(
        @NotNull(message = "The payment method is required.")
        PaymentMethod paymentMethod,

        @DecimalMin(value = "0.01", message = "The payment amount must be greater than zero.")
        BigDecimal amount,

        Boolean chargeInterestAndPenalty
) {
}
