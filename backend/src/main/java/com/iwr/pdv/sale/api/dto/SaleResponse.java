package com.iwr.pdv.sale.api.dto;

import com.iwr.pdv.auth.api.dto.UserResponse;
import com.iwr.pdv.sale.domain.PaymentMethod;
import com.iwr.pdv.sale.domain.SaleStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public record SaleResponse(
        @Schema(description = "Sale identifier", example = "1")
        Long id,
        @Schema(description = "Sale status")
        SaleStatus status,
        @Schema(description = "Sale operator")
        UserResponse operator,
        @Schema(description = "Payment method")
        PaymentMethod paymentMethod,
        @Schema(description = "Subtotal before discount", example = "319.80")
        BigDecimal subtotalAmount,
        @Schema(description = "Discount amount", example = "20.00")
        BigDecimal discountAmount,
        @Schema(description = "Total sale amount", example = "299.80")
        BigDecimal totalAmount,
        @Schema(description = "Received amount", example = "300.00")
        BigDecimal amountReceived,
        @Schema(description = "Change amount", example = "0.20")
        BigDecimal changeAmount,
        @Schema(description = "Number of items in the sale", example = "2")
        Integer totalItems,
        @Schema(description = "Sale timestamp", example = "2026-04-25T16:00:00Z")
        OffsetDateTime soldAt,
        @Schema(description = "Cancellation timestamp")
        OffsetDateTime cancelledAt,
        @Schema(description = "Cancellation reason")
        String cancellationReason,
        @Schema(description = "Creation timestamp", example = "2026-04-25T16:00:00Z")
        OffsetDateTime createdAt,
        @Schema(description = "Sale items")
        List<SaleItemResponse> items
) {
}
