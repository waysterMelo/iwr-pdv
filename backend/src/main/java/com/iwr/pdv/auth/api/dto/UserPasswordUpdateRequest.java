package com.iwr.pdv.auth.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UserPasswordUpdateRequest(
        @NotBlank(message = "The password is required.")
        @Size(min = 6, max = 80, message = "The password must have between 6 and 80 characters.")
        String password
) {
}
