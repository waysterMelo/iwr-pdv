package com.iwr.pdv.sale.mapper;

import com.iwr.pdv.product.domain.Product;
import com.iwr.pdv.sale.api.dto.SaleItemResponse;
import com.iwr.pdv.sale.api.dto.SaleResponse;
import com.iwr.pdv.sale.domain.Sale;
import com.iwr.pdv.sale.domain.SaleItem;
import java.math.BigDecimal;
import org.springframework.stereotype.Component;

@Component
public class SaleMapper {

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
                sale.getTotalAmount(),
                sale.getItems().stream().mapToInt(SaleItem::getQuantity).sum(),
                sale.getSoldAt(),
                sale.getCreatedAt(),
                sale.getItems()
                        .stream()
                        .map(this::toItemResponse)
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
}
