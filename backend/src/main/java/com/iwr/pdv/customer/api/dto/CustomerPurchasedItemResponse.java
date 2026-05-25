package com.iwr.pdv.customer.api.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record CustomerPurchasedItemResponse(
        Long productId,
        String productName,
        String productCode,
        Integer quantity,
        BigDecimal totalAmount,
        OffsetDateTime lastPurchaseAt
) {
}
