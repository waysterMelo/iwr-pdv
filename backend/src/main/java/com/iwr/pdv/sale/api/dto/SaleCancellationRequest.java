package com.iwr.pdv.sale.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SaleCancellationRequest(
        @NotBlank(message = "The cancellation reason is required.")
        @Size(max = 240, message = "The cancellation reason must have at most 240 characters.")
        String reason
) {
}
