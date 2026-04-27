package com.iwr.pdv.product.api.dto;

import com.iwr.pdv.auth.api.dto.UserResponse;
import com.iwr.pdv.product.domain.ProductBatchStatus;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public record ProductBatchResponse(
        Long id,
        String name,
        ProductBatchStatus status,
        Integer totalProducts,
        Integer totalPieces,
        UserResponse createdBy,
        OffsetDateTime labelsPrintedAt,
        OffsetDateTime catalogedAt,
        LocalDate sentToStoreAt,
        String storeShipmentNote,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        List<ProductResponse> products
) {
}
