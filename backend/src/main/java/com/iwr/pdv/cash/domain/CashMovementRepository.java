package com.iwr.pdv.cash.domain;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CashMovementRepository extends JpaRepository<CashMovement, Long> {

    List<CashMovement> findByCashRegisterIdOrderByCreatedAtDesc(Long cashRegisterId);

    void deleteByCashRegisterId(Long cashRegisterId);
}
