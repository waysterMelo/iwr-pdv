package com.iwr.pdv.sale.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;

public record SaleItemResponse(
        @Schema(description = "Sale item identifier", example = "1")
        Long id,
        @Schema(description = "Product identifier", example = "1")
        Long productId,
        @Schema(description = "Product name snapshot", example = "Vestido midi floral")
        String productName,
        @Schema(description = "Product code snapshot", example = "IWR-000001")
        String productCode,
        @Schema(description = "Quantity sold", example = "2")
        Integer quantity,
        @Schema(description = "Unit price at sale time", example = "149.90")
        BigDecimal unitPrice,
        @Schema(description = "Item subtotal", example = "299.80")
        BigDecimal subtotal
) {
}
