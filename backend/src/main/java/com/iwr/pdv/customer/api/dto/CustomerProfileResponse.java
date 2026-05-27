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
        List<CustomerPromissoryNoteResponse> promissoryNotes
) {
}
