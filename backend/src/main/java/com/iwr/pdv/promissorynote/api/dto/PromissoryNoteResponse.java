package com.iwr.pdv.promissorynote.api.dto;

import com.iwr.pdv.auth.api.dto.UserResponse;
import com.iwr.pdv.customer.api.dto.CustomerResponse;
import com.iwr.pdv.promissorynote.domain.PromissoryNoteStatus;
import com.iwr.pdv.sale.api.dto.SaleItemResponse;
import com.iwr.pdv.sale.domain.PaymentMethod;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public record PromissoryNoteResponse(
        Long id,
        Long saleId,
        CustomerResponse customer,
        Integer installmentNumber,
        Integer totalInstallments,
        BigDecimal amount,
        LocalDate dueDate,
        PromissoryNoteStatus status,
        OffsetDateTime paidAt,
        UserResponse paidBy,
        PaymentMethod paymentMethod,
        Long cashRegisterId,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        List<SaleItemResponse> saleItems
) {
}
