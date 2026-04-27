package com.iwr.pdv.product.application;

import com.iwr.pdv.product.api.dto.ProductCategoryResponse;
import java.util.List;

public interface ProductCategoryService {

    List<ProductCategoryResponse> listActive();
}
