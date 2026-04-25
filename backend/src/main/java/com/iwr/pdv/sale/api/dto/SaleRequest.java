package com.iwr.pdv.sale.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record SaleRequest(
        @Valid
        @NotEmpty(message = "The sale must have at least one item.")
        @Schema(description = "Sale items")
        List<SaleItemRequest> items
) {
}
