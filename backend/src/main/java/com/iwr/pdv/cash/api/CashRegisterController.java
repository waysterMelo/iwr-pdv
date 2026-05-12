package com.iwr.pdv.cash.api;

import com.iwr.pdv.auth.domain.AppUser;
import com.iwr.pdv.cash.api.dto.CashMovementRequest;
import com.iwr.pdv.cash.api.dto.CashRegisterCloseRequest;
import com.iwr.pdv.cash.api.dto.CashRegisterOpenRequest;
import com.iwr.pdv.cash.api.dto.CashRegisterPageResponse;
import com.iwr.pdv.cash.api.dto.CashRegisterReopenRequest;
import com.iwr.pdv.cash.api.dto.CashRegisterResponse;
import com.iwr.pdv.cash.application.CashRegisterReportService;
import com.iwr.pdv.cash.application.CashRegisterService;
import com.iwr.pdv.cash.domain.CashRegisterStatus;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/cash-register")
@Tag(name = "Cash Register", description = "Cash register opening, movement and closing endpoints.")
public class CashRegisterController {

    private final CashRegisterService cashRegisterService;
    private final CashRegisterReportService reportService;

    public CashRegisterController(
            CashRegisterService cashRegisterService,
            CashRegisterReportService reportService
    ) {
        this.cashRegisterService = cashRegisterService;
        this.reportService = reportService;
    }

    @GetMapping
    @Operation(summary = "List cash registers with filters")
    public CashRegisterPageResponse list(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate openedStartDate,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate openedEndDate,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate closedStartDate,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate closedEndDate,
            @RequestParam(required = false) CashRegisterStatus status,
            @RequestParam(required = false) Long operatorId,
            @RequestParam(required = false) Boolean withDifference,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "8") int size,
            HttpServletRequest servletRequest
    ) {
        return cashRegisterService.list(
                openedStartDate,
                openedEndDate,
                closedStartDate,
                closedEndDate,
                status,
                operatorId,
                withDifference,
                page,
                size
        );
    }

    @PostMapping("/open")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Open the cash register")
    public CashRegisterResponse open(
            @Valid @RequestBody CashRegisterOpenRequest request,
            HttpServletRequest servletRequest
    ) {
        return cashRegisterService.open(request, currentUser(servletRequest));
    }

    @PostMapping("/movements")
    @Operation(summary = "Add cash in or cash out movement")
    public CashRegisterResponse addMovement(
            @Valid @RequestBody CashMovementRequest request,
            HttpServletRequest servletRequest
    ) {
        return cashRegisterService.addMovement(request, currentUser(servletRequest));
    }

    @GetMapping("/current")
    @Operation(summary = "Return the currently open cash register")
    public ResponseEntity<CashRegisterResponse> current() {
        return cashRegisterService.current()
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/{cashRegisterId}")
    @Operation(summary = "Find a cash register by id")
    public CashRegisterResponse findById(@PathVariable Long cashRegisterId) {
        return cashRegisterService.findById(cashRegisterId);
    }

    @PostMapping("/{cashRegisterId}/close")
    @Operation(summary = "Close the cash register")
    public CashRegisterResponse close(
            @PathVariable Long cashRegisterId,
            @Valid @RequestBody CashRegisterCloseRequest request,
            HttpServletRequest servletRequest
    ) {
        return cashRegisterService.close(cashRegisterId, request, currentUser(servletRequest));
    }

    @PostMapping("/{cashRegisterId}/reopen")
    @Operation(summary = "Reopen a closed cash register")
    public CashRegisterResponse reopen(
            @PathVariable Long cashRegisterId,
            @Valid @RequestBody CashRegisterReopenRequest request,
            HttpServletRequest servletRequest
    ) {
        AppUser operator = currentUser(servletRequest);
        return cashRegisterService.reopen(cashRegisterId, request, operator);
    }

    @GetMapping("/current/report")
    @Operation(summary = "Download the current cash register report as PDF")
    public ResponseEntity<byte[]> downloadReport() {
        return cashRegisterService.current()
                .map(cashRegister -> {
                    byte[] pdfBytes = reportService.generateReport(cashRegister);
                    HttpHeaders headers = new HttpHeaders();
                    headers.setContentType(MediaType.APPLICATION_PDF);
                    headers.setContentDispositionFormData("attachment", "relatorio-caixa.pdf");
                    return new ResponseEntity<>(pdfBytes, headers, HttpStatus.OK);
                })
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/{cashRegisterId}/report")
    @Operation(summary = "Download a cash register report as PDF")
    public ResponseEntity<byte[]> downloadReportById(@PathVariable Long cashRegisterId) {
        CashRegisterResponse cashRegister = cashRegisterService.findById(cashRegisterId);
        byte[] pdfBytes = reportService.generateReport(cashRegister);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDispositionFormData("attachment", "relatorio-caixa-" + cashRegisterId + ".pdf");
        return new ResponseEntity<>(pdfBytes, headers, HttpStatus.OK);
    }

    private AppUser currentUser(HttpServletRequest request) {
        return (AppUser) request.getAttribute("authenticatedUser");
    }
}
