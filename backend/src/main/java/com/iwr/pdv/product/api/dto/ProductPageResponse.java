package com.iwr.pdv.product.api.dto;

import java.util.List;

public record ProductPageResponse(
        List<ProductResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean first,
        boolean last
) {
}
