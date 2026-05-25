package com.iwr.pdv.product.domain;

import jakarta.persistence.LockModeType;
import java.math.BigDecimal;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductRepository extends JpaRepository<Product, Long> {

    Optional<Product> findByCodeIgnoreCase(String code);

    Optional<Product> findByCodeEndingWith(String suffix);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select product from Product product where product.id = :id")
    Optional<Product> findByIdForUpdate(@Param("id") Long id);

    @Query("select coalesce(sum(p.stockQuantity), 0) from Product p")
    long sumTotalStockQuantity();

    @Query("select coalesce(sum(p.costPrice * p.stockQuantity), 0) from Product p")
    BigDecimal sumTotalCostValue();

    @Query("select coalesce(sum(p.price * p.stockQuantity), 0) from Product p")
    BigDecimal sumTotalSaleValue();
}
