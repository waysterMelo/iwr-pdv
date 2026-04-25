package com.iwr.pdv.cash.api.dto;

import com.iwr.pdv.cash.domain.CashMovementType;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record CashMovementRequest(
        @NotNull(message = "The movement type is required.")
        CashMovementType type,
        @NotNull(message = "The movement amount is required.")
        @DecimalMin(value = "0.01", message = "The movement amount must be greater than zero.")
        BigDecimal amount,
        @NotBlank(message = "The movement reason is required.")
        @Size(max = 180, message = "The movement reason must have at most 180 characters.")
        String reason
) {
}
