package com.iwr.pdv.product.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ProductCategoryRequest(
        @NotBlank(message = "The category name is required.")
        @Size(max = 80, message = "The category name must have at most 80 characters.")
        String name,
        @Size(max = 40, message = "The category icon must have at most 40 characters.")
        String icon
) {
}

