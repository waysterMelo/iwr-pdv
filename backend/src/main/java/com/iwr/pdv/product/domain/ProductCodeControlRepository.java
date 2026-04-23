package com.iwr.pdv.product.domain;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface ProductCodeControlRepository extends JpaRepository<ProductCodeControl, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT control FROM ProductCodeControl control WHERE control.id = 1")
    Optional<ProductCodeControl> lockControlRow();
}
