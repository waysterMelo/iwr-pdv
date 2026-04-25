package com.iwr.pdv.cash.api.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record CashRegisterOpenRequest(
        @NotNull(message = "The opening amount is required.")
        @DecimalMin(value = "0.00", message = "The opening amount cannot be negative.")
        BigDecimal openingAmount
) {
}
