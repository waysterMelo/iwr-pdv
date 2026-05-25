package com.iwr.pdv.promissorynote.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record PromissoryNoteManualRequest(
        @NotNull(message = "Customer is required.")
        Long customerId,

        @Valid
        @NotEmpty(message = "At least one product is required.")
        List<Item> items,

        @DecimalMin(value = "0.00", message = "Discount cannot be negative.")
        BigDecimal discountAmount,

        @NotEmpty(message = "At least one installment is required.")
        List<@Valid Installment> installments
) {
    public record Item(
            @NotNull(message = "Product is required.")
            Long productId,

            @NotNull(message = "Quantity is required.")
            Integer quantity,

            @NotNull(message = "Unit price is required.")
            @DecimalMin(value = "0.01", message = "Unit price must be greater than zero.")
            BigDecimal unitPrice
    ) {
    }

    public record Installment(
            @NotNull(message = "Due date is required.")
            LocalDate dueDate,

            @NotNull(message = "Amount is required.")
            @DecimalMin(value = "0.01", message = "Amount must be greater than zero.")
            BigDecimal amount
    ) {
    }
}
