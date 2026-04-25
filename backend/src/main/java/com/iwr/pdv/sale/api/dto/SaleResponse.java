package com.iwr.pdv.sale.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public record SaleResponse(
        @Schema(description = "Sale identifier", example = "1")
        Long id,
        @Schema(description = "Total sale amount", example = "299.80")
        BigDecimal totalAmount,
        @Schema(description = "Number of items in the sale", example = "2")
        Integer totalItems,
        @Schema(description = "Sale timestamp", example = "2026-04-25T16:00:00Z")
        OffsetDateTime soldAt,
        @Schema(description = "Creation timestamp", example = "2026-04-25T16:00:00Z")
        OffsetDateTime createdAt,
        @Schema(description = "Sale items")
        List<SaleItemResponse> items
) {
}
