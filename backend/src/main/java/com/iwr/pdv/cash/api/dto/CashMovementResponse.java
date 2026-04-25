package com.iwr.pdv.cash.api.dto;

import com.iwr.pdv.auth.api.dto.UserResponse;
import com.iwr.pdv.cash.domain.CashMovementType;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record CashMovementResponse(
        Long id,
        CashMovementType type,
        BigDecimal amount,
        String reason,
        UserResponse operator,
        OffsetDateTime createdAt
) {
}
