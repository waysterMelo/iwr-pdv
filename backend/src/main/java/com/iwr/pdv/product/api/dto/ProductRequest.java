package com.iwr.pdv.product.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

public record ProductRequest(
        @Schema(
                description = "Product display name",
                example = "Vestido midi floral"
        )
        @NotBlank(message = "The product name is required.")
        @Size(max = 120, message = "The product name must have at most 120 characters.")
        String name,

        @Schema(
                description = "Unique product code. Leave empty to generate automatically in the IWR-000001 format.",
                example = "IWR-000001"
        )
        @Size(max = 30, message = "The product code must have at most 30 characters.")
        String code,

        @Schema(
                description = "Product category identifier",
                example = "1"
        )
        @NotNull(message = "The product category is required.")
        Long categoryId,

        @Schema(
                description = "Current sale price",
                example = "149.90"
        )
        @NotNull(message = "The product price is required.")
        @DecimalMin(value = "0.01", message = "The product price must be greater than zero.")
        BigDecimal price,

        @Schema(
                description = "Cost price of the product",
                example = "49.90"
        )
        @DecimalMin(value = "0.00", message = "The cost price must be zero or greater.")
        BigDecimal costPrice,

        @Schema(
                description = "Available stock quantity",
                example = "8"
        )
        @NotNull(message = "The stock quantity is required.")
        @PositiveOrZero(message = "The stock quantity must be zero or greater.")
        Integer stockQuantity,

        @Schema(
                description = "Whether the product is active for operations",
                example = "true"
        )
        @NotNull(message = "The active flag is required.")
        Boolean active,

        @Schema(
                description = "Product lot date",
                example = "2026-05-24"
        )
        LocalDate lotDate
) {
}
