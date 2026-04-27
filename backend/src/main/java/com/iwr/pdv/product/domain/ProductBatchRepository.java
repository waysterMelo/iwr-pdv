package com.iwr.pdv.product.domain;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductBatchRepository extends JpaRepository<ProductBatch, Long> {

    List<ProductBatch> findAllByOrderByCreatedAtDesc();
}
