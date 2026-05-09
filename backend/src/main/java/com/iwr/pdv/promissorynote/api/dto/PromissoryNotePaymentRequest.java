package com.iwr.pdv.promissorynote.api.dto;

import com.iwr.pdv.sale.domain.PaymentMethod;
import jakarta.validation.constraints.NotNull;

public record PromissoryNotePaymentRequest(
        @NotNull(message = "The payment method is required.")
        PaymentMethod paymentMethod
) {
}
