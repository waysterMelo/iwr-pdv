package com.iwr.pdv.cash.api.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record CashRegisterCloseRequest(
        @NotNull(message = "The declared cash amount is required.")
        @DecimalMin(value = "0.00", message = "The declared cash amount cannot be negative.")
        BigDecimal declaredCashAmount,

        @Size(max = 240, message = "The closing difference reason must contain at most 240 characters.")
        String closingDifferenceReason
) {
}
