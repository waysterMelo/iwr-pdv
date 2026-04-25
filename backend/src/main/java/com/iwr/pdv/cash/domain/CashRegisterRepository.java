package com.iwr.pdv.cash.domain;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CashRegisterRepository extends JpaRepository<CashRegister, Long> {

    Optional<CashRegister> findFirstByStatusOrderByOpenedAtDesc(CashRegisterStatus status);
}
