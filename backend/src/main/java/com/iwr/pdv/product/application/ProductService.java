package com.iwr.pdv.product.application;

import com.iwr.pdv.product.api.dto.ProductActivationRequest;
import com.iwr.pdv.product.api.dto.ProductPageResponse;
import com.iwr.pdv.product.api.dto.ProductRequest;
import com.iwr.pdv.product.api.dto.ProductResponse;
import java.math.BigDecimal;
import java.util.List;

public interface ProductService {

    ProductResponse create(ProductRequest request);

    List<ProductResponse> list(String search);

    ProductPageResponse listPage(
            String search,
            Boolean active,
            String stockStatus,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            Long categoryId,
            int lowStockThreshold,
            int page,
            int size,
            String sort,
            String direction
    );

    ProductResponse findById(Long productId);

    ProductResponse findByCodeForSale(String code);

    ProductResponse update(Long productId, ProductRequest request);

    ProductResponse updateActivation(Long productId, ProductActivationRequest request);

    byte[] generateBarcode(Long productId);

    String generateLabel(Long productId);

    String generateLabels(java.util.List<Long> productIds);
}
