package com.iwr.pdv.customer.api.dto;

import com.iwr.pdv.sale.api.dto.SaleResponse;
import java.math.BigDecimal;
import java.util.List;

public record CustomerProfileResponse(
        CustomerResponse customer,
        Integer saleCount,
        Integer completedSaleCount,
        Integer cancelledSaleCount,
        BigDecimal totalPurchasedAmount,
        BigDecimal totalDiscountAmount,
        BigDecimal averageTicketAmount,
        Long openPromissoryCount,
        Long overduePromissoryCount,
        Long paidPromissoryCount,
        Long cancelledPromissoryCount,
        BigDecimal openPromissoryAmount,
        BigDecimal overduePromissoryAmount,
        BigDecimal paidPromissoryAmount,
        List<CustomerPurchasedItemResponse> purchasedItems,
        List<SaleResponse> latestSales,
        List<SaleResponse> sales,
        List<SaleResponse> cancelledSales,
        List<CustomerPromissoryNoteResponse> promissoryNotes,
        List<CustomerProfileInsightResponse> insights
) {
    public CustomerProfileResponse {
        purchasedItems = purchasedItems != null ? List.copyOf(purchasedItems) : java.util.Collections.emptyList();
        latestSales = latestSales != null ? List.copyOf(latestSales) : java.util.Collections.emptyList();
        sales = sales != null ? List.copyOf(sales) : java.util.Collections.emptyList();
        cancelledSales = cancelledSales != null ? List.copyOf(cancelledSales) : java.util.Collections.emptyList();
        promissoryNotes = promissoryNotes != null ? List.copyOf(promissoryNotes) : java.util.Collections.emptyList();
        insights = insights != null ? List.copyOf(insights) : java.util.Collections.emptyList();
    }
}
