package com.iwr.pdv.product.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

public record ProductCategoryResponse(
        @Schema(description = "Category identifier", example = "1")
        Long id,
        @Schema(description = "Category display name", example = "Vestidos")
        String name,
        @Schema(description = "Icon key used by the frontend", example = "dress")
        String icon,
        @Schema(description = "Whether the category is available for products", example = "true")
        Boolean active
) {
}
