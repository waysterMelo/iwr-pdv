package com.iwr.pdv.sale.mapper;

import com.iwr.pdv.auth.mapper.AuthMapper;
import com.iwr.pdv.customer.mapper.CustomerMapper;
import com.iwr.pdv.product.domain.Product;
import com.iwr.pdv.promissorynote.api.dto.PromissoryNoteSummaryResponse;
import com.iwr.pdv.promissorynote.domain.PromissoryNote;
import com.iwr.pdv.sale.api.dto.SaleItemResponse;
import com.iwr.pdv.sale.api.dto.SaleResponse;
import com.iwr.pdv.sale.domain.Sale;
import com.iwr.pdv.sale.domain.SaleItem;
import java.math.BigDecimal;
import org.springframework.stereotype.Component;

@Component
public class SaleMapper {

    private final AuthMapper authMapper;
    private final CustomerMapper customerMapper;

    public SaleMapper(AuthMapper authMapper, CustomerMapper customerMapper) {
        this.authMapper = authMapper;
        this.customerMapper = customerMapper;
    }

    public SaleItem toItem(Product product, int quantity) {
        BigDecimal subtotal = product.getPrice().multiply(BigDecimal.valueOf(quantity));

        SaleItem item = new SaleItem();
        item.setProduct(product);
        item.setProductName(product.getName());
        item.setProductCode(product.getCode());
        item.setQuantity(quantity);
        item.setUnitPrice(product.getPrice());
        item.setSubtotal(subtotal);

        return item;
    }

    public SaleResponse toResponse(Sale sale) {
        return new SaleResponse(
                sale.getId(),
                sale.getStatus(),
                sale.getOperator() == null ? null : authMapper.toResponse(sale.getOperator()),
                customerMapper.toResponse(sale.getCustomer()),
                sale.getPaymentMethod(),
                sale.getSubtotalAmount(),
                sale.getDiscountAmount(),
                sale.getTotalAmount(),
                sale.getAmountReceived(),
                sale.getChangeAmount(),
                sale.getItems().stream().mapToInt(SaleItem::getQuantity).sum(),
                sale.getSoldAt(),
                sale.getCancelledAt(),
                sale.getCancellationReason(),
                sale.getCreatedAt(),
                sale.getItems()
                        .stream()
                        .map(this::toItemResponse)
                        .toList(),
                sale.getPromissoryNotes()
                        .stream()
                        .map(this::toPromissoryNoteSummary)
                        .toList()
        );
    }

    private SaleItemResponse toItemResponse(SaleItem item) {
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

    private PromissoryNoteSummaryResponse toPromissoryNoteSummary(PromissoryNote note) {
        return new PromissoryNoteSummaryResponse(
                note.getId(),
                note.getInstallmentNumber(),
                note.getTotalInstallments(),
                note.getAmount(),
                note.getDueDate(),
                note.getStatus()
        );
    }
}
