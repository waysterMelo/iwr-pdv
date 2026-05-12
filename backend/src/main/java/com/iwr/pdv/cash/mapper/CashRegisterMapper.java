package com.iwr.pdv.cash.mapper;

import com.iwr.pdv.auth.mapper.AuthMapper;
import com.iwr.pdv.cash.api.dto.CashMovementResponse;
import com.iwr.pdv.cash.api.dto.CashRegisterResponse;
import com.iwr.pdv.cash.domain.CashMovement;
import com.iwr.pdv.cash.domain.CashRegister;
import com.iwr.pdv.sale.domain.PaymentMethod;
import com.iwr.pdv.sale.domain.Sale;
import com.iwr.pdv.sale.mapper.SaleMapper;
import java.math.BigDecimal;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class CashRegisterMapper {

    private final AuthMapper authMapper;
    private final SaleMapper saleMapper;

    public CashRegisterMapper(AuthMapper authMapper, SaleMapper saleMapper) {
        this.authMapper = authMapper;
        this.saleMapper = saleMapper;
    }

    public CashRegisterResponse toResponse(
            CashRegister cashRegister,
            List<CashMovement> movements,
            List<Sale> sales,
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
                cashRegister.getClosingDifferenceReason(),
                totalSalesAmount,
                cashSalesAmount,
                cashInAmount,
                cashOutAmount,
                toStringKeyMap(totalsByPaymentMethod),
                authMapper.toResponse(cashRegister.getOpenedBy()),
                cashRegister.getClosedBy() == null ? null : authMapper.toResponse(cashRegister.getClosedBy()),
                cashRegister.getReopenedBy() == null ? null : authMapper.toResponse(cashRegister.getReopenedBy()),
                cashRegister.getOpenedAt(),
                cashRegister.getClosedAt(),
                cashRegister.getReopenedAt(),
                cashRegister.getReopenReason(),
                sales.stream().map(saleMapper::toResponse).toList(),
                movements.stream().map(this::toMovementResponse).toList()
        );
    }

    private CashMovementResponse toMovementResponse(CashMovement movement) {
        return new CashMovementResponse(
                movement.getId(),
                movement.getMovementType(),
                movement.getAmount(),
                movement.getReason(),
                movement.getPaymentMethod(),
                movement.getReferenceType(),
                movement.getReferenceId(),
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
