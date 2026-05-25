package com.iwr.pdv.product.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public record ProductResponse(
        @Schema(description = "Product identifier", example = "1")
        Long id,
        @Schema(description = "Product name", example = "Vestido midi floral")
        String name,
        @Schema(description = "Unique product code", example = "IWR-001")
        String code,
        @Schema(description = "Product category identifier", example = "1")
        Long categoryId,
        @Schema(description = "Product category name", example = "Vestidos")
        String categoryName,
        @Schema(description = "Product category icon key", example = "dress")
        String categoryIcon,
        @Schema(description = "Current price", example = "149.90")
        BigDecimal price,
        @Schema(description = "Cost price", example = "49.90")
        BigDecimal costPrice,
        @Schema(description = "Current stock quantity", example = "8")
        Integer stockQuantity,
        @Schema(description = "Whether the product is active", example = "true")
        Boolean active,
        @Schema(description = "Product lot date", example = "2026-05-24")
        LocalDate lotDate,
        @Schema(description = "Creation timestamp", example = "2026-04-22T20:00:00Z")
        OffsetDateTime createdAt,
        @Schema(description = "Last update timestamp", example = "2026-04-22T20:15:00Z")
        OffsetDateTime updatedAt
) {
}
