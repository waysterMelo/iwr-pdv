package com.iwr.pdv.promissorynote.mapper;

import com.iwr.pdv.auth.mapper.AuthMapper;
import com.iwr.pdv.customer.mapper.CustomerMapper;
import com.iwr.pdv.promissorynote.api.dto.PromissoryNotePaymentResponse;
import com.iwr.pdv.promissorynote.api.dto.PromissoryNoteResponse;
import com.iwr.pdv.promissorynote.domain.PromissoryNote;
import com.iwr.pdv.promissorynote.domain.PromissoryNotePayment;
import com.iwr.pdv.sale.api.dto.SaleItemResponse;
import com.iwr.pdv.sale.domain.SaleItem;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class PromissoryNoteMapper {

    private final CustomerMapper customerMapper;
    private final AuthMapper authMapper;
    private final Clock clock;

    public PromissoryNoteMapper(CustomerMapper customerMapper, AuthMapper authMapper, Clock clock) {
        this.customerMapper = customerMapper;
        this.authMapper = authMapper;
        this.clock = clock;
    }

    public PromissoryNoteResponse toResponse(PromissoryNote note) {
        return new PromissoryNoteResponse(
                note.getId(),
                note.getSale() == null ? null : note.getSale().getId(),
                customerMapper.toResponse(note.getCustomer()),
                note.getInstallmentNumber(),
                note.getTotalInstallments(),
                note.getAmount(),
                paidAmount(note),
                remainingAmount(note),
                updatedAmount(note),
                daysOverdue(note),
                note.getDueDate(),
                note.getStatus(),
                note.getPaidAt(),
                note.getPaidBy() == null ? null : authMapper.toResponse(note.getPaidBy()),
                note.getPaymentMethod(),
                note.getCreatedAt(),
                note.getUpdatedAt(),
                note.getSale() == null ? List.of() : note.getSale().getItems().stream().map(this::toSaleItemResponse).toList()
        );
    }

    public PromissoryNotePaymentResponse toPaymentResponse(PromissoryNotePayment payment) {
        return new PromissoryNotePaymentResponse(
                payment.getId(),
                payment.getAmount(),
                payment.getPenaltyAmount(),
                payment.getInterestAmount(),
                payment.getTotalReceived(),
                payment.getPaymentMethod(),
                authMapper.toResponse(payment.getPaidBy()),
                payment.getPaidAt()
        );
    }

    private BigDecimal paidAmount(PromissoryNote note) {
        return note.getPaidAmount() == null ? BigDecimal.ZERO : note.getPaidAmount();
    }

    private BigDecimal remainingAmount(PromissoryNote note) {
        BigDecimal remaining = note.getAmount().subtract(paidAmount(note));
        return remaining.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : remaining;
    }

    private long daysOverdue(PromissoryNote note) {
        LocalDate today = LocalDate.now(clock);
        if (!note.getDueDate().isBefore(today)) {
            return 0;
        }

        return ChronoUnit.DAYS.between(note.getDueDate(), today);
    }

    private BigDecimal updatedAmount(PromissoryNote note) {
        BigDecimal remaining = remainingAmount(note);
        if (remaining.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }

        long daysOverdue = daysOverdue(note);
        if (daysOverdue == 0) {
            return remaining;
        }

        BigDecimal penalty = remaining.multiply(new BigDecimal("0.02"));
        BigDecimal interest = remaining.multiply(new BigDecimal("0.003")).multiply(BigDecimal.valueOf(daysOverdue));
        return remaining.add(penalty).add(interest).setScale(2, RoundingMode.HALF_UP);
    }

    private SaleItemResponse toSaleItemResponse(SaleItem item) {
        return new SaleItemResponse(
                item.getId(),
                item.getProduct().getId(),
                item.getProductName(),
                item.getProductCode(),
                item.getQuantity(),
                item.getUnitPrice(),
                item.getSubtotal()
        );
    }
}
