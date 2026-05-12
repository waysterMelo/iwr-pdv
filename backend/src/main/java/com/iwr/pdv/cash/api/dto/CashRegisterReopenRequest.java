package com.iwr.pdv.cash.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CashRegisterReopenRequest(
        @NotBlank(message = "The reopen reason is required.")
        @Size(max = 240, message = "The reopen reason must contain at most 240 characters.")
        String reason
) {
}
