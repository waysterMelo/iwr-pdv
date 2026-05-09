package com.iwr.pdv.sale.api.dto;

import com.iwr.pdv.sale.domain.PaymentMethod;
import com.iwr.pdv.promissorynote.api.dto.PromissoryInstallmentRequest;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.List;

public record SaleRequest(
        @Valid
        @NotEmpty(message = "The sale must have at least one item.")
        @Schema(description = "Sale items")
        List<SaleItemRequest> items,
        @NotNull(message = "The payment method is required.")
        @Schema(description = "Payment method")
        PaymentMethod paymentMethod,
        @DecimalMin(value = "0.00", message = "The discount amount cannot be negative.")
        @Schema(description = "Discount amount in BRL")
        BigDecimal discountAmount,
        @DecimalMin(value = "0.00", message = "The received amount cannot be negative.")
        @Schema(description = "Amount received from the customer for cash payments")
        BigDecimal amountReceived,
        @Schema(description = "Customer id required for promissory note sales")
        Long customerId,
        @Valid
        @Schema(description = "Installments required for promissory note sales")
        List<PromissoryInstallmentRequest> promissoryInstallments
) {
}
