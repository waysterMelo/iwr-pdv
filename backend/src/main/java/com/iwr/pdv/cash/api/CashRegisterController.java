package com.iwr.pdv.cash.api;

import com.iwr.pdv.auth.domain.AppUser;
import com.iwr.pdv.cash.api.dto.CashMovementRequest;
import com.iwr.pdv.cash.api.dto.CashRegisterCloseRequest;
import com.iwr.pdv.cash.api.dto.CashRegisterOpenRequest;
import com.iwr.pdv.cash.api.dto.CashRegisterResponse;
import com.iwr.pdv.cash.application.CashRegisterService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/cash-register")
@Tag(name = "Cash Register", description = "Cash register opening, movement and closing endpoints.")
public class CashRegisterController {

    private final CashRegisterService cashRegisterService;

    public CashRegisterController(CashRegisterService cashRegisterService) {
        this.cashRegisterService = cashRegisterService;
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

    @PostMapping("/{cashRegisterId}/close")
    @Operation(summary = "Close the cash register")
    public CashRegisterResponse close(
            @PathVariable Long cashRegisterId,
            @Valid @RequestBody CashRegisterCloseRequest request,
            HttpServletRequest servletRequest
    ) {
        return cashRegisterService.close(cashRegisterId, request, currentUser(servletRequest));
    }

    private AppUser currentUser(HttpServletRequest request) {
        return (AppUser) request.getAttribute("authenticatedUser");
    }
}
