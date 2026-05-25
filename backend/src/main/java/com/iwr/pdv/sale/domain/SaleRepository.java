package com.iwr.pdv.sale.domain;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SaleRepository extends JpaRepository<Sale, Long> {

    @EntityGraph(attributePaths = {"items", "operator", "customer"})
    List<Sale> findBySoldAtBetweenOrderBySoldAtDesc(OffsetDateTime start, OffsetDateTime end);

    @EntityGraph(attributePaths = {"items", "operator", "cashRegister", "customer"})
    List<Sale> findByCashRegisterIdAndStatus(Long cashRegisterId, SaleStatus status);

    @EntityGraph(attributePaths = {"items", "operator", "customer"})
    List<Sale> findAllByOrderBySoldAtDesc();

    @EntityGraph(attributePaths = {"items", "operator", "customer"})
    List<Sale> findByCustomerIdOrderBySoldAtDesc(Long customerId);

    @Override
    @EntityGraph(attributePaths = {"items", "operator", "customer"})
    Optional<Sale> findById(Long id);
}
