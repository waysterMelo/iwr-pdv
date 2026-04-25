package com.iwr.pdv.sale.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record SaleItemRequest(
        @NotNull(message = "The product id is required.")
        @Schema(description = "Product identifier", example = "1")
        Long productId,
        @NotNull(message = "The quantity is required.")
        @Min(value = 1, message = "The quantity must be at least 1.")
        @Schema(description = "Quantity sold", example = "2")
        Integer quantity
) {
}
