package com.iwr.pdv.product.api.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record ProductBatchItemRequest(
        @NotBlank(message = "The product name is required.")
        @Size(max = 120, message = "The product name must have at most 120 characters.")
        String name,
        @Size(max = 30, message = "The product code must have at most 30 characters.")
        String code,
        @NotNull(message = "The product category is required.")
        Long categoryId,
        @NotNull(message = "The product price is required.")
        @DecimalMin(value = "0.01", message = "The product price must be greater than zero.")
        BigDecimal price,
        @NotNull(message = "The stock quantity is required.")
        @Positive(message = "The stock quantity must be greater than zero for batch creation.")
        Integer stockQuantity,
        @NotNull(message = "The active flag is required.")
        Boolean active
) {
}
