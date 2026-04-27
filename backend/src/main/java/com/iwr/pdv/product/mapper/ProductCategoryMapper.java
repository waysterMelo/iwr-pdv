package com.iwr.pdv.product.mapper;

import com.iwr.pdv.product.api.dto.ProductCategoryResponse;
import com.iwr.pdv.product.domain.ProductCategory;
import org.springframework.stereotype.Component;

@Component
public class ProductCategoryMapper {

    public ProductCategoryResponse toResponse(ProductCategory category) {
        return new ProductCategoryResponse(
                category.getId(),
                category.getName(),
                category.getIcon(),
                category.getActive()
        );
    }
}
