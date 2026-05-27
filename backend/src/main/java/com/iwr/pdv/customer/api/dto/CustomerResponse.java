package com.iwr.pdv.customer.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public record CustomerResponse(
        Long id,
        String name,
        String cpf,
        String phone,
        String email,
        String address,
        LocalDate birthDate,
        Boolean active,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        String observations,
        BigDecimal creditLimit
) {
}
