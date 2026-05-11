package com.iwr.pdv.cash.application;

import com.iwr.pdv.audit.application.AuditLogService;
import com.iwr.pdv.audit.domain.AuditAction;
import com.iwr.pdv.auth.domain.AppUser;
import com.iwr.pdv.cash.api.dto.CashMovementRequest;
import com.iwr.pdv.cash.api.dto.CashRegisterCloseRequest;
import com.iwr.pdv.cash.api.dto.CashRegisterOpenRequest;
import com.iwr.pdv.cash.api.dto.CashRegisterResponse;
import com.iwr.pdv.cash.domain.CashMovement;
import com.iwr.pdv.cash.domain.CashMovementRepository;
import com.iwr.pdv.cash.domain.CashMovementType;
import com.iwr.pdv.cash.domain.CashRegister;
import com.iwr.pdv.cash.domain.CashRegisterRepository;
import com.iwr.pdv.cash.domain.CashRegisterStatus;
import com.iwr.pdv.cash.mapper.CashRegisterMapper;
import com.iwr.pdv.common.exception.BusinessRuleException;
import com.iwr.pdv.common.exception.ResourceNotFoundException;
import com.iwr.pdv.sale.domain.PaymentMethod;
import com.iwr.pdv.sale.domain.Sale;
import com.iwr.pdv.sale.domain.SaleRepository;
import com.iwr.pdv.sale.domain.SaleStatus;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CashRegisterServiceImpl implements CashRegisterService {

    private final CashRegisterRepository cashRegisterRepository;
    private final CashMovementRepository cashMovementRepository;
    private final SaleRepository saleRepository;
    private final CashRegisterMapper cashRegisterMapper;
    private final AuditLogService auditLogService;
    private final Clock clock;

    public CashRegisterServiceImpl(
            CashRegisterRepository cashRegisterRepository,
            CashMovementRepository cashMovementRepository,
            SaleRepository saleRepository,
            CashRegisterMapper cashRegisterMapper,
            AuditLogService auditLogService,
            Clock clock
    ) {
        this.cashRegisterRepository = cashRegisterRepository;
        this.cashMovementRepository = cashMovementRepository;
        this.saleRepository = saleRepository;
        this.cashRegisterMapper = cashRegisterMapper;
        this.auditLogService = auditLogService;
        this.clock = clock;
    }

    @Override
    @Transactional
    public CashRegisterResponse open(CashRegisterOpenRequest request, AppUser operator) {
        if (cashRegisterRepository.findFirstByStatusOrderByOpenedAtDesc(CashRegisterStatus.OPEN).isPresent()) {
            throw new BusinessRuleException("There is already an open cash register.");
        }

        OffsetDateTime now = OffsetDateTime.now(clock);
        CashRegister cashRegister = new CashRegister();
        cashRegister.setStatus(CashRegisterStatus.OPEN);
        cashRegister.setOpeningAmount(request.openingAmount());
        cashRegister.setOpenedBy(operator);
        cashRegister.setOpenedAt(now);
        cashRegister.setCreatedAt(now);

        CashRegister savedCashRegister = cashRegisterRepository.save(cashRegister);
        auditLogService.log(
                AuditAction.CASH_REGISTER_OPENED,
                operator,
                "CASH_REGISTER",
                savedCashRegister.getId(),
                "Opening amount: " + savedCashRegister.getOpeningAmount() + "."
        );

        return toResponse(savedCashRegister);
    }

    @Override
    @Transactional
    public CashRegisterResponse addMovement(CashMovementRequest request, AppUser operator) {
        CashRegister cashRegister = requireOpenRegister();

        CashMovement movement = new CashMovement();
        movement.setCashRegister(cashRegister);
        movement.setMovementType(request.type());
        movement.setAmount(request.amount());
        movement.setReason(request.reason().trim());
        movement.setPaymentMethod(PaymentMethod.CASH);
        movement.setOperator(operator);
        movement.setCreatedAt(OffsetDateTime.now(clock));
        CashMovement savedMovement = cashMovementRepository.save(movement);
        auditLogService.log(
                AuditAction.CASH_MOVEMENT_CREATED,
                operator,
                "CASH_MOVEMENT",
                savedMovement.getId(),
                request.type() + " amount: " + request.amount() + ". Reason: " + request.reason().trim()
        );

        return toResponse(cashRegister);
    }

    @Override
    @Transactional
    public CashRegisterResponse close(Long cashRegisterId, CashRegisterCloseRequest request, AppUser operator) {
        CashRegister cashRegister = cashRegisterRepository.findById(cashRegisterId)
                .orElseThrow(() -> new ResourceNotFoundException("Cash register not found for id " + cashRegisterId + "."));

        if (cashRegister.getStatus() == CashRegisterStatus.CLOSED) {
            throw new BusinessRuleException("Cash register is already closed.");
        }

        CashTotals totals = calculateTotals(cashRegister);
        BigDecimal expectedCashAmount = cashRegister.getOpeningAmount()
                .add(totals.totalsByPaymentMethod().getOrDefault(PaymentMethod.CASH, BigDecimal.ZERO))
                .add(totals.cashInAmount())
                .subtract(totals.cashOutAmount());

        cashRegister.setStatus(CashRegisterStatus.CLOSED);
        cashRegister.setClosedBy(operator);
        cashRegister.setClosedAt(OffsetDateTime.now(clock));
        cashRegister.setDeclaredCashAmount(request.declaredCashAmount());
        cashRegister.setExpectedCashAmount(expectedCashAmount);
        cashRegister.setCashDifference(request.declaredCashAmount().subtract(expectedCashAmount));

        CashRegister savedCashRegister = cashRegisterRepository.save(cashRegister);
        auditLogService.log(
                AuditAction.CASH_REGISTER_CLOSED,
                operator,
                "CASH_REGISTER",
                savedCashRegister.getId(),
                "Declared: " + savedCashRegister.getDeclaredCashAmount()
                        + ". Expected: " + savedCashRegister.getExpectedCashAmount()
                        + ". Difference: " + savedCashRegister.getCashDifference() + "."
        );

        return toResponse(savedCashRegister);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<CashRegisterResponse> current() {
        return cashRegisterRepository.findFirstByStatusOrderByOpenedAtDesc(CashRegisterStatus.OPEN)
                .map(this::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public CashRegister requireOpenRegister() {
        return cashRegisterRepository.findFirstByStatusOrderByOpenedAtDesc(CashRegisterStatus.OPEN)
                .orElseThrow(() -> new BusinessRuleException("Open the cash register before closing sales."));
    }

    @Override
    @Transactional
    public CashRegister registerReceivablePayment(
            BigDecimal amount,
            PaymentMethod paymentMethod,
            String reason,
            AppUser operator,
            String referenceType,
            Long referenceId
    ) {
        CashRegister cashRegister = requireOpenRegister();

        CashMovement movement = new CashMovement();
        movement.setCashRegister(cashRegister);
        movement.setMovementType(CashMovementType.CASH_IN);
        movement.setAmount(amount);
        movement.setReason(reason);
        movement.setPaymentMethod(paymentMethod);
        movement.setReferenceType(referenceType);
        movement.setReferenceId(referenceId);
        movement.setOperator(operator);
        movement.setCreatedAt(OffsetDateTime.now(clock));
        cashMovementRepository.save(movement);

        return cashRegister;
    }

    @Override
    @Transactional
    public CashRegister registerReceivableReversal(
            BigDecimal amount,
            PaymentMethod paymentMethod,
            String reason,
            AppUser operator,
            String referenceType,
            Long referenceId
    ) {
        CashRegister cashRegister = requireOpenRegister();

        CashMovement movement = new CashMovement();
        movement.setCashRegister(cashRegister);
        movement.setMovementType(CashMovementType.CASH_OUT);
        movement.setAmount(amount);
        movement.setReason(reason);
        movement.setPaymentMethod(paymentMethod);
        movement.setReferenceType(referenceType);
        movement.setReferenceId(referenceId);
        movement.setOperator(operator);
        movement.setCreatedAt(OffsetDateTime.now(clock));
        cashMovementRepository.save(movement);

        return cashRegister;
    }

    @Override
    @Transactional(readOnly = true)
    public CashRegisterResponse toResponse(CashRegister cashRegister) {
        CashTotals totals = calculateTotals(cashRegister);
        return cashRegisterMapper.toResponse(
                cashRegister,
                cashMovementRepository.findByCashRegisterIdOrderByCreatedAtDesc(cashRegister.getId()),
                totals.totalsByPaymentMethod(),
                totals.cashInAmount(),
                totals.cashOutAmount()
        );
    }

    private CashTotals calculateTotals(CashRegister cashRegister) {
        Map<PaymentMethod, BigDecimal> totalsByPaymentMethod = new EnumMap<>(PaymentMethod.class);
        for (PaymentMethod paymentMethod : PaymentMethod.values()) {
            totalsByPaymentMethod.put(paymentMethod, BigDecimal.ZERO);
        }

        for (Sale sale : saleRepository.findByCashRegisterIdAndStatus(cashRegister.getId(), SaleStatus.COMPLETED)) {
            totalsByPaymentMethod.merge(sale.getPaymentMethod(), sale.getTotalAmount(), BigDecimal::add);
        }

        BigDecimal cashInAmount = BigDecimal.ZERO;
        BigDecimal cashOutAmount = BigDecimal.ZERO;
        List<CashMovement> movements = cashMovementRepository.findByCashRegisterIdOrderByCreatedAtDesc(cashRegister.getId());
        for (CashMovement movement : movements) {
            if (movement.getMovementType() == CashMovementType.CASH_IN) {
                if (movement.getPaymentMethod() == null || movement.getPaymentMethod() == PaymentMethod.CASH) {
                    cashInAmount = cashInAmount.add(movement.getAmount());
                }
            } else if (movement.getMovementType() == CashMovementType.CASH_OUT) {
                if (movement.getPaymentMethod() == null || movement.getPaymentMethod() == PaymentMethod.CASH) {
                    cashOutAmount = cashOutAmount.add(movement.getAmount());
                }
            }
        }

        return new CashTotals(totalsByPaymentMethod, cashInAmount, cashOutAmount);
    }

    private record CashTotals(
            Map<PaymentMethod, BigDecimal> totalsByPaymentMethod,
            BigDecimal cashInAmount,
            BigDecimal cashOutAmount
    ) {
    }
}
