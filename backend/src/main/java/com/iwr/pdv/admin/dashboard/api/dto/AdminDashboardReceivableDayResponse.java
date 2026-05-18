package com.iwr.pdv.admin.dashboard.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record AdminDashboardReceivableDayResponse(
        LocalDate date,
        BigDecimal amount,
        long count
) {
}
