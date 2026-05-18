package com.iwr.pdv.admin.dashboard.api;

import com.iwr.pdv.admin.dashboard.api.dto.AdminDashboardPaymentMethodResponse;
import com.iwr.pdv.admin.dashboard.api.dto.AdminDashboardReceivablesResponse;
import com.iwr.pdv.admin.dashboard.api.dto.AdminDashboardSummaryResponse;
import com.iwr.pdv.admin.dashboard.application.AdminDashboardService;
import com.iwr.pdv.auth.domain.AppUser;
import com.iwr.pdv.auth.infrastructure.AuthorizationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/dashboard")
@Tag(name = "Admin Dashboard", description = "Administrative sales and receivables dashboard.")
public class AdminDashboardController {

    private final AdminDashboardService adminDashboardService;
    private final AuthorizationService authorizationService;

    public AdminDashboardController(
            AdminDashboardService adminDashboardService,
            AuthorizationService authorizationService
    ) {
        this.adminDashboardService = adminDashboardService;
        this.authorizationService = authorizationService;
    }

    @GetMapping("/summary")
    @Operation(summary = "Return sales and receivables summary for the selected period")
    public AdminDashboardSummaryResponse summary(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate startDate,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate endDate,
            HttpServletRequest servletRequest
    ) {
        requireAdmin(servletRequest);
        return adminDashboardService.summary(startDate, endDate);
    }

    @GetMapping("/payment-methods")
    @Operation(summary = "Return sales and receipts grouped by payment method")
    public List<AdminDashboardPaymentMethodResponse> paymentMethods(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate startDate,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate endDate,
            HttpServletRequest servletRequest
    ) {
        requireAdmin(servletRequest);
        return adminDashboardService.paymentMethods(startDate, endDate);
    }

    @GetMapping("/receivables")
    @Operation(summary = "Return receivables summary and open installments")
    public AdminDashboardReceivablesResponse receivables(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate startDate,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate endDate,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate calendarStartDate,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate calendarEndDate,
            HttpServletRequest servletRequest
    ) {
        requireAdmin(servletRequest);
        return adminDashboardService.receivables(startDate, endDate, calendarStartDate, calendarEndDate);
    }

    @GetMapping("/report")
    @Operation(summary = "Download administrative dashboard report as PDF")
    public ResponseEntity<byte[]> report(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate startDate,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate endDate,
            HttpServletRequest servletRequest
    ) {
        requireAdmin(servletRequest);
        byte[] pdfBytes = adminDashboardService.report(startDate, endDate);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDispositionFormData("attachment", "relatorio-admin.pdf");
        return new ResponseEntity<>(pdfBytes, headers, HttpStatus.OK);
    }

    private void requireAdmin(HttpServletRequest request) {
        authorizationService.requireAdmin((AppUser) request.getAttribute("authenticatedUser"));
    }
}
