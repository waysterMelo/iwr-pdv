package com.iwr.pdv.product.api;

import com.iwr.pdv.auth.domain.AppUser;
import com.iwr.pdv.auth.infrastructure.AuthorizationService;
import com.iwr.pdv.product.api.dto.ProductBatchCreateRequest;
import com.iwr.pdv.product.api.dto.ProductBatchResponse;
import com.iwr.pdv.product.api.dto.ProductBatchStoreShipmentRequest;
import com.iwr.pdv.product.application.ProductBatchService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/product-batches")
@Tag(name = "Product Batches", description = "Cataloging batches and batch label endpoints.")
public class ProductBatchController {

    private final ProductBatchService batchService;
    private final AuthorizationService authorizationService;

    public ProductBatchController(
            ProductBatchService batchService,
            AuthorizationService authorizationService
    ) {
        this.batchService = batchService;
        this.authorizationService = authorizationService;
    }

    @GetMapping
    @Operation(summary = "List product cataloging batches")
    public List<ProductBatchResponse> list(HttpServletRequest servletRequest) {
        authorizationService.requireAdmin(currentUser(servletRequest));
        return batchService.list();
    }

    @GetMapping("/{batchId}")
    @Operation(summary = "Find a product cataloging batch")
    public ProductBatchResponse findById(@PathVariable Long batchId, HttpServletRequest servletRequest) {
        authorizationService.requireAdmin(currentUser(servletRequest));
        return batchService.findById(batchId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create a product cataloging batch with products")
    public ProductBatchResponse create(
            @Valid @RequestBody ProductBatchCreateRequest request,
            HttpServletRequest servletRequest
    ) {
        AppUser user = currentUser(servletRequest);
        authorizationService.requireAdmin(user);
        return batchService.create(request, user);
    }

    @GetMapping(value = "/{batchId}/labels", produces = MediaType.TEXT_HTML_VALUE)
    @Operation(summary = "Generate printable labels for a batch")
    public ResponseEntity<String> generateLabels(@PathVariable Long batchId, HttpServletRequest servletRequest) {
        authorizationService.requireAdmin(currentUser(servletRequest));
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_HTML)
                .body(batchService.generateLabels(batchId));
    }

    @PatchMapping("/{batchId}/labels-printed")
    @Operation(summary = "Mark batch labels as printed")
    public ProductBatchResponse markLabelsPrinted(@PathVariable Long batchId, HttpServletRequest servletRequest) {
        authorizationService.requireAdmin(currentUser(servletRequest));
        return batchService.markLabelsPrinted(batchId);
    }

    @PatchMapping("/{batchId}/cataloged")
    @Operation(summary = "Mark batch as cataloged")
    public ProductBatchResponse markCataloged(@PathVariable Long batchId, HttpServletRequest servletRequest) {
        authorizationService.requireAdmin(currentUser(servletRequest));
        return batchService.markCataloged(batchId);
    }

    @PatchMapping("/{batchId}/sent-to-store")
    @Operation(summary = "Mark batch as sent to the store")
    public ProductBatchResponse markSentToStore(
            @PathVariable Long batchId,
            @Valid @RequestBody ProductBatchStoreShipmentRequest request,
            HttpServletRequest servletRequest
    ) {
        authorizationService.requireAdmin(currentUser(servletRequest));
        return batchService.markSentToStore(batchId, request);
    }

    private AppUser currentUser(HttpServletRequest request) {
        return (AppUser) request.getAttribute("authenticatedUser");
    }
}
