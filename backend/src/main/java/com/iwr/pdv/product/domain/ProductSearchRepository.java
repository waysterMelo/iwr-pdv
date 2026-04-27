package com.iwr.pdv.product.domain;

import java.math.BigDecimal;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface ProductSearchRepository {

    List<Product> findAllBySearch(String search);

    Page<Product> findPageByFilters(
            String search,
            Boolean active,
            String stockStatus,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            Long categoryId,
            int lowStockThreshold,
            Pageable pageable
    );
}
