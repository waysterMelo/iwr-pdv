package com.iwr.pdv.cash.api.dto;

import com.iwr.pdv.auth.api.dto.UserResponse;
import com.iwr.pdv.cash.domain.CashRegisterStatus;
import com.iwr.pdv.sale.api.dto.SaleResponse;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

public record CashRegisterResponse(
        Long id,
        CashRegisterStatus status,
        BigDecimal openingAmount,
        BigDecimal declaredCashAmount,
        BigDecimal expectedCashAmount,
        BigDecimal cashDifference,
        String closingDifferenceReason,
        BigDecimal totalSalesAmount,
        BigDecimal cashSalesAmount,
        BigDecimal cashInAmount,
        BigDecimal cashOutAmount,
        Map<String, BigDecimal> totalsByPaymentMethod,
        UserResponse openedBy,
        UserResponse closedBy,
        UserResponse reopenedBy,
        OffsetDateTime openedAt,
        OffsetDateTime closedAt,
        OffsetDateTime reopenedAt,
        String reopenReason,
        List<SaleResponse> sales,
        List<CashMovementResponse> movements
) {
}
