package com.iwr.pdv.product.api;

import com.iwr.pdv.auth.domain.AppUser;
import com.iwr.pdv.auth.infrastructure.AuthorizationService;
import com.iwr.pdv.product.api.dto.ProductCategoryResponse;
import com.iwr.pdv.product.application.ProductCategoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/product-categories")
@Tag(name = "Product Categories", description = "Product category endpoints.")
public class ProductCategoryController {

    private final ProductCategoryService categoryService;
    private final AuthorizationService authorizationService;

    public ProductCategoryController(
            ProductCategoryService categoryService,
            AuthorizationService authorizationService
    ) {
        this.categoryService = categoryService;
        this.authorizationService = authorizationService;
    }

    @GetMapping
    @Operation(summary = "List active product categories")
    public List<ProductCategoryResponse> list(HttpServletRequest servletRequest) {
        authorizationService.requireAdmin(currentUser(servletRequest));
        return categoryService.listActive();
    }

    private AppUser currentUser(HttpServletRequest request) {
        return (AppUser) request.getAttribute("authenticatedUser");
    }
}
