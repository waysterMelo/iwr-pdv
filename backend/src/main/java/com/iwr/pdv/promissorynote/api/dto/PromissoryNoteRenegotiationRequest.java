package com.iwr.pdv.promissorynote.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record PromissoryNoteRenegotiationRequest(
        @NotEmpty(message = "At least one promissory note is required.")
        List<Long> noteIds,

        @NotBlank(message = "The renegotiation reason is required.")
        @Size(max = 240, message = "The renegotiation reason must contain at most 240 characters.")
        String reason,

        @NotEmpty(message = "At least one new installment is required.")
        List<@Valid Installment> installments
) {
    public record Installment(
            @NotNull(message = "The due date is required.")
            LocalDate dueDate,

            @NotNull(message = "The amount is required.")
            BigDecimal amount
    ) {
    }
}
