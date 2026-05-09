package com.iwr.pdv.promissorynote.api.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public record PromissoryInstallmentRequest(
        @NotNull(message = "The installment due date is required.")
        @FutureOrPresent(message = "The installment due date cannot be in the past.")
        LocalDate dueDate,
        @NotNull(message = "The installment amount is required.")
        @DecimalMin(value = "0.01", message = "The installment amount must be greater than zero.")
        BigDecimal amount
) {
}
