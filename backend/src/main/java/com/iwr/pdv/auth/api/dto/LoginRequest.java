package com.iwr.pdv.auth.api.dto;

import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        @NotBlank(message = "The username is required.")
        String username,
        @NotBlank(message = "The password is required.")
        String password
) {
}
