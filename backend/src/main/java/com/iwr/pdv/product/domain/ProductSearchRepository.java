package com.iwr.pdv.product.domain;

import java.util.List;

public interface ProductSearchRepository {

    List<Product> findAllBySearch(String search);
}
