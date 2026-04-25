package com.iwr.pdv.cash.mapper;

import com.iwr.pdv.auth.mapper.AuthMapper;
import com.iwr.pdv.cash.api.dto.CashMovementResponse;
import com.iwr.pdv.cash.api.dto.CashRegisterResponse;
import com.iwr.pdv.cash.domain.CashMovement;
import com.iwr.pdv.cash.domain.CashRegister;
import com.iwr.pdv.sale.domain.PaymentMethod;
import java.math.BigDecimal;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class CashRegisterMapper {

    private final AuthMapper authMapper;

    public CashRegisterMapper(AuthMapper authMapper) {
        this.authMapper = authMapper;
    }

    public CashRegisterResponse toResponse(
            CashRegister cashRegister,
            List<CashMovement> movements,
            Map<PaymentMethod, BigDecimal> totalsByPaymentMethod,
            BigDecimal cashInAmount,
            BigDecimal cashOutAmount
    ) {
        BigDecimal cashSalesAmount = totalsByPaymentMethod.getOrDefault(PaymentMethod.CASH, BigDecimal.ZERO);
        BigDecimal totalSalesAmount = totalsByPaymentMethod.values()
                .stream()
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal expectedCashAmount = cashRegister.getExpectedCashAmount() == null
                ? cashRegister.getOpeningAmount().add(cashSalesAmount).add(cashInAmount).subtract(cashOutAmount)
                : cashRegister.getExpectedCashAmount();

        return new CashRegisterResponse(
                cashRegister.getId(),
                cashRegister.getStatus(),
                cashRegister.getOpeningAmount(),
                cashRegister.getDeclaredCashAmount(),
                expectedCashAmount,
                cashRegister.getCashDifference(),
                totalSalesAmount,
                cashSalesAmount,
                cashInAmount,
                cashOutAmount,
                toStringKeyMap(totalsByPaymentMethod),
                authMapper.toResponse(cashRegister.getOpenedBy()),
                cashRegister.getClosedBy() == null ? null : authMapper.toResponse(cashRegister.getClosedBy()),
                cashRegister.getOpenedAt(),
                cashRegister.getClosedAt(),
                movements.stream().map(this::toMovementResponse).toList()
        );
    }

    private CashMovementResponse toMovementResponse(CashMovement movement) {
        return new CashMovementResponse(
                movement.getId(),
                movement.getMovementType(),
                movement.getAmount(),
                movement.getReason(),
                authMapper.toResponse(movement.getOperator()),
                movement.getCreatedAt()
        );
    }

    private Map<String, BigDecimal> toStringKeyMap(Map<PaymentMethod, BigDecimal> totals) {
        Map<PaymentMethod, BigDecimal> completeTotals = new EnumMap<>(PaymentMethod.class);
        for (PaymentMethod paymentMethod : PaymentMethod.values()) {
            completeTotals.put(paymentMethod, totals.getOrDefault(paymentMethod, BigDecimal.ZERO));
        }

        return completeTotals.entrySet()
                .stream()
                .collect(java.util.stream.Collectors.toMap(
                        entry -> entry.getKey().name(),
                        Map.Entry::getValue,
                        (first, second) -> first,
                        java.util.LinkedHashMap::new
                ));
    }
}
