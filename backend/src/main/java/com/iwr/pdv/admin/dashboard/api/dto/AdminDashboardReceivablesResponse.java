package com.iwr.pdv.admin.dashboard.api.dto;

import java.math.BigDecimal;
import java.util.List;

public record AdminDashboardReceivablesResponse(
        BigDecimal openAmount,
        BigDecimal overdueAmount,
        BigDecimal dueTodayAmount,
        BigDecimal dueNext7DaysAmount,
        BigDecimal dueNext30DaysAmount,
        List<AdminDashboardTopCustomerResponse> topCustomers,
        List<AdminDashboardReceivableResponse> items
) {
}
