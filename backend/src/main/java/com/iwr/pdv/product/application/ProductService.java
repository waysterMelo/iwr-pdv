package com.iwr.pdv.product.application;

import com.iwr.pdv.product.api.dto.ProductActivationRequest;
import com.iwr.pdv.product.api.dto.ProductRequest;
import com.iwr.pdv.product.api.dto.ProductResponse;
import java.util.List;

public interface ProductService {

    ProductResponse create(ProductRequest request);

    List<ProductResponse> list(String search);

    ProductResponse findById(Long productId);

    ProductResponse update(Long productId, ProductRequest request);

    ProductResponse updateActivation(Long productId, ProductActivationRequest request);

    byte[] generateQrCode(Long productId);

    String generateLabel(Long productId);
}
