package com.iwr.pdv.admin.dashboard.api.dto;

import java.math.BigDecimal;

public record AdminDashboardTopProductResponse(
        String productName,
        String productCode,
        long quantity,
        BigDecimal totalRevenue
) {
}
