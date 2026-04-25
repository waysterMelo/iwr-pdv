package com.iwr.pdv.sale.domain;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SaleRepository extends JpaRepository<Sale, Long> {

    @EntityGraph(attributePaths = "items")
    List<Sale> findBySoldAtBetweenOrderBySoldAtDesc(OffsetDateTime start, OffsetDateTime end);

    @EntityGraph(attributePaths = "items")
    List<Sale> findAllByOrderBySoldAtDesc();

    @Override
    @EntityGraph(attributePaths = "items")
    Optional<Sale> findById(Long id);
}
