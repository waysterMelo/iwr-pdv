package com.iwr.pdv.product.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

public record ProductActivationRequest(
        @Schema(
                description = "Desired activation status",
                example = "false"
        )
        @NotNull(message = "The active flag is required.")
        Boolean active
) {
}
