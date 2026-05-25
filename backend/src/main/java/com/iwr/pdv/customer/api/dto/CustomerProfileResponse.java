package com.iwr.pdv.customer.api.dto;

import com.iwr.pdv.promissorynote.api.dto.PromissoryNoteResponse;
import com.iwr.pdv.sale.api.dto.SaleResponse;
import java.math.BigDecimal;
import java.util.List;

public record CustomerProfileResponse(
        CustomerResponse customer,
        Integer saleCount,
        BigDecimal totalPurchasedAmount,
        Long openPromissoryCount,
        Long overduePromissoryCount,
        BigDecimal openPromissoryAmount,
        BigDecimal overduePromissoryAmount,
        BigDecimal paidPromissoryAmount,
        List<CustomerPurchasedItemResponse> purchasedItems,
        List<SaleResponse> latestSales,
        List<PromissoryNoteResponse> promissoryNotes
) {
}
