package com.iwr.pdv.cash.api.dto;

import java.util.List;

public record CashRegisterPageResponse(
        List<CashRegisterResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean first,
        boolean last
) {
}
