package com.iwr.pdv.product.application;

import com.iwr.pdv.product.api.dto.ProductCategoryRequest;
import com.iwr.pdv.product.api.dto.ProductCategoryResponse;
import java.util.List;

public interface ProductCategoryService {

    List<ProductCategoryResponse> listActive();

    ProductCategoryResponse create(ProductCategoryRequest request);
}
