package com.iwr.pdv.customer.api;

import com.iwr.pdv.auth.domain.AppUser;
import com.iwr.pdv.auth.infrastructure.AuthorizationService;
import com.iwr.pdv.customer.api.dto.CustomerRequest;
import com.iwr.pdv.customer.api.dto.CustomerPageResponse;
import com.iwr.pdv.customer.api.dto.CustomerProfileResponse;
import com.iwr.pdv.customer.api.dto.CustomerResponse;
import com.iwr.pdv.customer.application.CustomerService;
import com.iwr.pdv.promissorynote.domain.PromissoryNoteStatus;
import com.iwr.pdv.sale.domain.SaleStatus;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/customers")
@Tag(name = "Customers", description = "Customer registration for sales and promissory notes.")
public class CustomerController {

    private final CustomerService customerService;
    private final AuthorizationService authorizationService;

    public CustomerController(CustomerService customerService, AuthorizationService authorizationService) {
        this.customerService = customerService;
        this.authorizationService = authorizationService;
    }

    @GetMapping
    @Operation(summary = "List active customers")
    public List<CustomerResponse> list(@RequestParam(required = false) String search) {
        return customerService.list(search);
    }

    @GetMapping("/page")
    @Operation(summary = "List active customers with pagination")
    public CustomerPageResponse listPage(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "6") int size
    ) {
        return customerService.listPage(search, page, size);
    }

    @GetMapping("/birthdays")
    @Operation(summary = "List active customers with birthday dates")
    public List<CustomerResponse> birthdays() {
        return customerService.birthdays();
    }

    @GetMapping("/{customerId}/profile")
    @Operation(summary = "Return customer profile with purchases and promissory notes")
    public CustomerProfileResponse profile(@PathVariable Long customerId, HttpServletRequest servletRequest) {
        authorizationService.requireAdmin(currentUser(servletRequest));
        return customerService.profile(customerId);
    }

    @GetMapping(value = "/{customerId}/profile/export", produces = "text/csv")
    @Operation(summary = "Export a complete customer profile as an Excel-compatible report")
    public ResponseEntity<String> exportProfileCsv(
            @PathVariable Long customerId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) SaleStatus saleStatus,
            @RequestParam(required = false) PromissoryNoteStatus noteStatus,
            HttpServletRequest servletRequest
    ) {
        authorizationService.requireAdmin(currentUser(servletRequest));
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=consulta-cliente-" + customerId + ".csv")
                .contentType(MediaType.parseMediaType("text/csv; charset=utf-8"))
                .body("\uFEFF" + customerService.exportProfileCsv(customerId, startDate, endDate, saleStatus, noteStatus));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create a customer")
    public CustomerResponse create(@Valid @RequestBody CustomerRequest request) {
        return customerService.create(request);
    }

    @PutMapping("/{customerId}")
    @Operation(summary = "Update a customer")
    public CustomerResponse update(
            @PathVariable Long customerId,
            @Valid @RequestBody CustomerRequest request
    ) {
        return customerService.update(customerId, request);
    }

    private AppUser currentUser(HttpServletRequest request) {
        return (AppUser) request.getAttribute("authenticatedUser");
    }
}
