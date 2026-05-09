package com.iwr.pdv.product.domain;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductRepository extends JpaRepository<Product, Long> {

    Optional<Product> findByCodeIgnoreCase(String code);

    Optional<Product> findByCodeEndingWith(String suffix);
}
