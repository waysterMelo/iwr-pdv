package com.iwr.pdv.admin.dashboard.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record AdminDashboardSummaryResponse(
        LocalDate startDate,
        LocalDate endDate,
        BigDecimal totalSold,
        BigDecimal totalReceived,
        BigDecimal totalCashSales,
        BigDecimal totalPixSales,
        BigDecimal totalDebitSales,
        BigDecimal totalCreditSales,
        BigDecimal totalPromissorySales,
        long saleCount,
        BigDecimal averageTicket,
        BigDecimal totalDiscounts,
        BigDecimal openReceivables,
        BigDecimal overdueReceivables,
        BigDecimal dueTodayReceivables,
        BigDecimal dueNext7DaysReceivables,
        BigDecimal dueNext30DaysReceivables
) {
}
