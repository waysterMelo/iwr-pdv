package com.iwr.pdv.product.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public record ProductBatchCreateRequest(
        @NotBlank(message = "The batch name is required.")
        @Size(max = 120, message = "The batch name must have at most 120 characters.")
        String name,
        @NotEmpty(message = "At least one product is required.")
        List<@Valid ProductBatchItemRequest> items
) {
}
