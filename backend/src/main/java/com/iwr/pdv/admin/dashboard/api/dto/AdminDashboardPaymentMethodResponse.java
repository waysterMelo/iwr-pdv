package com.iwr.pdv.admin.dashboard.api.dto;

import com.iwr.pdv.sale.domain.PaymentMethod;
import java.math.BigDecimal;

public record AdminDashboardPaymentMethodResponse(
        PaymentMethod paymentMethod,
        BigDecimal soldAmount,
        BigDecimal receivedAmount,
        long saleCount,
        long receiptCount
) {
}
