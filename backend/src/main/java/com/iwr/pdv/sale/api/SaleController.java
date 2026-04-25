package com.iwr.pdv.sale.api;

import com.iwr.pdv.auth.domain.AppUser;
import com.iwr.pdv.sale.api.dto.SaleCancellationRequest;
import com.iwr.pdv.sale.api.dto.SaleRequest;
import com.iwr.pdv.sale.api.dto.SaleResponse;
import com.iwr.pdv.sale.application.SaleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
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
@RequestMapping("/api/sales")
@Tag(name = "Sales", description = "Sales closing and history endpoints.")
public class SaleController {

    private final SaleService saleService;

    public SaleController(SaleService saleService) {
        this.saleService = saleService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Close a sale and decrease stock")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Sale closed successfully"),
            @ApiResponse(responseCode = "400", description = "Invalid sale payload"),
            @ApiResponse(responseCode = "404", description = "Product not found"),
            @ApiResponse(
                    responseCode = "422",
                    description = "Business rule violation, such as insufficient stock",
                    content = @Content(
                            examples = @ExampleObject(
                                    value = """
                                            {
                                              "status": 422,
                                              "error": "Unprocessable Entity",
                                              "message": "Product 'IWR-000001' has insufficient stock. Available: 1.",
                                              "path": "/api/sales",
                                              "timestamp": "2026-04-25T16:00:00Z"
                                            }
                                            """
                            )
                    )
            )
    })
    public SaleResponse closeSale(
            @Valid @RequestBody SaleRequest request,
            HttpServletRequest servletRequest
    ) {
        return saleService.closeSale(request, currentUser(servletRequest));
    }

    @GetMapping
    @Operation(summary = "List sales with optional date filters")
    @ApiResponse(responseCode = "200", description = "Sales returned successfully")
    public List<SaleResponse> list(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate startDate,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate endDate
    ) {
        return saleService.list(startDate, endDate);
    }

    @GetMapping("/{saleId}")
    @Operation(summary = "Find a sale by id")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Sale returned successfully"),
            @ApiResponse(responseCode = "404", description = "Sale not found")
    })
    public SaleResponse findById(@PathVariable Long saleId) {
        return saleService.findById(saleId);
    }

    @PostMapping("/{saleId}/cancel")
    @Operation(summary = "Cancel a sale and restore stock")
    public SaleResponse cancel(
            @PathVariable Long saleId,
            @Valid @RequestBody SaleCancellationRequest request,
            HttpServletRequest servletRequest
    ) {
        return saleService.cancel(saleId, request, currentUser(servletRequest));
    }

    @GetMapping(value = "/{saleId}/receipt", produces = MediaType.TEXT_HTML_VALUE)
    @Operation(summary = "Generate a non fiscal sale receipt")
    public ResponseEntity<String> receipt(@PathVariable Long saleId) {
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_HTML)
                .body(saleService.generateReceipt(saleId));
    }

    private AppUser currentUser(HttpServletRequest request) {
        return (AppUser) request.getAttribute("authenticatedUser");
    }
}
