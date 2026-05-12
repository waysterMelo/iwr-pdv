package com.iwr.pdv.admin.dashboard.application;

import com.iwr.pdv.admin.dashboard.api.dto.AdminDashboardPaymentMethodResponse;
import com.iwr.pdv.admin.dashboard.api.dto.AdminDashboardReceivablesResponse;
import com.iwr.pdv.admin.dashboard.api.dto.AdminDashboardSummaryResponse;
import java.time.LocalDate;
import java.util.List;

public interface AdminDashboardService {

    AdminDashboardSummaryResponse summary(LocalDate startDate, LocalDate endDate);

    List<AdminDashboardPaymentMethodResponse> paymentMethods(LocalDate startDate, LocalDate endDate);

    AdminDashboardReceivablesResponse receivables(LocalDate startDate, LocalDate endDate);

    byte[] report(LocalDate startDate, LocalDate endDate);
}
