package com.iwr.pdv.admin.dashboard.api.dto;

import java.math.BigDecimal;

public record AdminDashboardTopCustomerResponse(
        Long customerId,
        String customerName,
        BigDecimal openAmount,
        long openInstallments
) {
}
