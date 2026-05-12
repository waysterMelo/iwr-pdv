package com.iwr.pdv.cash.domain;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface CashRegisterRepository extends JpaRepository<CashRegister, Long>, JpaSpecificationExecutor<CashRegister> {

    Optional<CashRegister> findFirstByStatusOrderByOpenedAtDesc(CashRegisterStatus status);
}
