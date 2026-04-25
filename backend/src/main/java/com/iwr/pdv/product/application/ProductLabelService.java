package com.iwr.pdv.product.application;

import com.iwr.pdv.product.domain.Product;

public interface ProductLabelService {

    String generateLabel(Product product);
}
