package com.iwr.pdv.auth.api.dto;

import com.iwr.pdv.auth.domain.UserRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UserCreateRequest(
        @NotBlank(message = "The username is required.")
        @Size(max = 80, message = "The username must have at most 80 characters.")
        String username,

        @NotBlank(message = "The display name is required.")
        @Size(max = 120, message = "The display name must have at most 120 characters.")
        String displayName,

        @NotBlank(message = "The password is required.")
        @Size(min = 6, max = 80, message = "The password must have between 6 and 80 characters.")
        String password,

        @NotNull(message = "The role is required.")
        UserRole role,

        @NotNull(message = "The active flag is required.")
        Boolean active
) {
}
