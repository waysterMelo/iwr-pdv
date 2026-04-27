package com.iwr.pdv.product.api.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record ProductBatchStoreShipmentRequest(
        @NotNull(message = "The store shipment date is required.")
        LocalDate sentToStoreAt,
        @Size(max = 255, message = "The store shipment note must have at most 255 characters.")
        String note
) {
}
