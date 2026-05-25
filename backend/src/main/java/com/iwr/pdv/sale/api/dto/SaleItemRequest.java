package com.iwr.pdv.sale.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record SaleItemRequest(
        @NotNull(message = "The product id is required.")
        @Schema(description = "Product identifier", example = "1")
        Long productId,
        @NotNull(message = "The quantity is required.")
        @Min(value = 1, message = "The quantity must be at least 1.")
        @Schema(description = "Quantity sold", example = "2")
        Integer quantity,
        @DecimalMin(value = "0.01", message = "The unit price must be greater than zero.")
        @Schema(description = "Optional unit price override for manual promissory note sales", example = "79.90")
        BigDecimal unitPrice
) {
}
