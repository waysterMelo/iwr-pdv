package com.iwr.pdv.cash.application;

import com.iwr.pdv.auth.domain.AppUser;
import com.iwr.pdv.cash.api.dto.CashMovementRequest;
import com.iwr.pdv.cash.api.dto.CashRegisterCloseRequest;
import com.iwr.pdv.cash.api.dto.CashRegisterOpenRequest;
import com.iwr.pdv.cash.api.dto.CashRegisterPageResponse;
import com.iwr.pdv.cash.api.dto.CashRegisterReopenRequest;
import com.iwr.pdv.cash.api.dto.CashRegisterResponse;
import com.iwr.pdv.cash.domain.CashRegister;
import com.iwr.pdv.cash.domain.CashRegisterStatus;
import com.iwr.pdv.sale.domain.PaymentMethod;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

public interface CashRegisterService {

    CashRegisterResponse open(CashRegisterOpenRequest request, AppUser operator);

    CashRegisterResponse addMovement(CashMovementRequest request, AppUser operator);

    CashRegisterResponse close(Long cashRegisterId, CashRegisterCloseRequest request, AppUser operator);

    CashRegisterResponse reopen(Long cashRegisterId, CashRegisterReopenRequest request, AppUser operator);

    CashRegisterPageResponse list(
            LocalDate openedStartDate,
            LocalDate openedEndDate,
            LocalDate closedStartDate,
            LocalDate closedEndDate,
            CashRegisterStatus status,
            Long operatorId,
            Boolean withDifference,
            int page,
            int size
    );

    CashRegisterResponse findById(Long cashRegisterId);

    Optional<CashRegisterResponse> current();

    CashRegister requireOpenRegister();

    CashRegister registerReceivablePayment(
            BigDecimal amount,
            PaymentMethod paymentMethod,
            String reason,
            AppUser operator,
            String referenceType,
            Long referenceId
    );

    CashRegister registerReceivableReversal(
            BigDecimal amount,
            PaymentMethod paymentMethod,
            String reason,
            AppUser operator,
            String referenceType,
            Long referenceId
    );

    CashRegisterResponse toResponse(CashRegister cashRegister);
}
