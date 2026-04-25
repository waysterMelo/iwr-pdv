package com.iwr.pdv.product.api;

import com.iwr.pdv.product.api.dto.ProductActivationRequest;
import com.iwr.pdv.product.api.dto.ProductPageResponse;
import com.iwr.pdv.product.api.dto.ProductRequest;
import com.iwr.pdv.product.api.dto.ProductResponse;
import com.iwr.pdv.product.application.ProductService;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/products")
@Tag(name = "Products", description = "Product management endpoints.")
public class ProductController {

    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create a new product")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Product created successfully"),
            @ApiResponse(
                    responseCode = "400",
                    description = "Invalid product payload",
                    content = @Content(
                            examples = @ExampleObject(
                                    value = """
                                            {
                                              "status": 400,
                                              "error": "Bad Request",
                                              "message": "Validation failed for the request payload.",
                                              "path": "/api/products",
                                              "timestamp": "2026-04-22T20:00:00Z",
                                              "violations": [
                                                {
                                                  "field": "name",
                                                  "message": "The product name is required."
                                                }
                                              ]
                                            }
                                            """
                            )
                    )
            ),
            @ApiResponse(
                    responseCode = "409",
                    description = "Product code already exists",
                    content = @Content(
                            examples = @ExampleObject(
                                    value = """
                                            {
                                              "status": 409,
                                              "error": "Conflict",
                                              "message": "A product with code 'IWR-001' already exists.",
                                              "path": "/api/products",
                                              "timestamp": "2026-04-22T20:00:00Z"
                                            }
                                            """
                            )
                    )
            )
    })
    public ProductResponse create(@Valid @RequestBody ProductRequest request) {
        return productService.create(request);
    }

    @GetMapping
    @Operation(summary = "List products with optional search by name or code")
    @ApiResponse(responseCode = "200", description = "Products returned successfully")
    public List<ProductResponse> list(@RequestParam(name = "search", required = false) String search) {
        return productService.list(search);
    }

    @GetMapping("/page")
    @Operation(summary = "List products with pagination and inventory filters")
    @ApiResponse(responseCode = "200", description = "Product page returned successfully")
    public ProductPageResponse listPage(
            @RequestParam(name = "search", required = false) String search,
            @RequestParam(name = "active", required = false) Boolean active,
            @RequestParam(name = "stockStatus", required = false) String stockStatus,
            @RequestParam(name = "minPrice", required = false) BigDecimal minPrice,
            @RequestParam(name = "maxPrice", required = false) BigDecimal maxPrice,
            @RequestParam(name = "lowStockThreshold", defaultValue = "5") int lowStockThreshold,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "12") int size,
            @RequestParam(name = "sort", defaultValue = "createdAt") String sort,
            @RequestParam(name = "direction", defaultValue = "desc") String direction
    ) {
        return productService.listPage(
                search,
                active,
                stockStatus,
                minPrice,
                maxPrice,
                lowStockThreshold,
                page,
                size,
                sort,
                direction
        );
    }

    @GetMapping("/{productId}")
    @Operation(summary = "Find a product by id")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Product returned successfully"),
            @ApiResponse(responseCode = "404", description = "Product not found")
    })
    public ProductResponse findById(@PathVariable Long productId) {
        return productService.findById(productId);
    }

    @PutMapping("/{productId}")
    @Operation(summary = "Update an existing product")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Product updated successfully"),
            @ApiResponse(responseCode = "400", description = "Invalid product payload"),
            @ApiResponse(responseCode = "404", description = "Product not found"),
            @ApiResponse(responseCode = "409", description = "Product code already exists")
    })
    public ProductResponse update(
            @PathVariable Long productId,
            @Valid @RequestBody ProductRequest request
    ) {
        return productService.update(productId, request);
    }

    @PatchMapping("/{productId}/activation")
    @Operation(summary = "Activate or inactivate a product")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Product activation updated successfully"),
            @ApiResponse(responseCode = "400", description = "Invalid activation payload"),
            @ApiResponse(responseCode = "404", description = "Product not found")
    })
    public ProductResponse updateActivation(
            @Parameter(description = "Product identifier") 
            @PathVariable Long productId,
            @Valid @RequestBody ProductActivationRequest request
    ) {
        return productService.updateActivation(productId, request);
    }

    @GetMapping(value = "/{productId}/qr-code", produces = MediaType.IMAGE_PNG_VALUE)
    @Operation(summary = "Generate the QR code image for a product")
    @ApiResponses({
            @ApiResponse(
                    responseCode = "200",
                    description = "PNG image generated successfully",
                    content = @Content(
                            mediaType = MediaType.IMAGE_PNG_VALUE,
                            schema = @Schema(type = "string", format = "binary")
                    )
            ),
            @ApiResponse(responseCode = "404", description = "Product not found")
    })
    public ResponseEntity<byte[]> generateQrCode(@PathVariable Long productId) {
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .body(productService.generateQrCode(productId));
    }

    @GetMapping(value = "/{productId}/label", produces = MediaType.TEXT_HTML_VALUE)
    @Operation(summary = "Generate a printable label for a product")
    @ApiResponses({
            @ApiResponse(
                    responseCode = "200",
                    description = "Printable HTML label generated successfully",
                    content = @Content(mediaType = MediaType.TEXT_HTML_VALUE)
            ),
            @ApiResponse(responseCode = "404", description = "Product not found")
    })
    public ResponseEntity<String> generateLabel(@PathVariable Long productId) {
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_HTML)
                .body(productService.generateLabel(productId));
    }
}
