package com.iwr.pdv.promissorynote.mapper;

import com.iwr.pdv.auth.mapper.AuthMapper;
import com.iwr.pdv.customer.mapper.CustomerMapper;
import com.iwr.pdv.promissorynote.api.dto.PromissoryNoteResponse;
import com.iwr.pdv.promissorynote.domain.PromissoryNote;
import com.iwr.pdv.sale.api.dto.SaleItemResponse;
import com.iwr.pdv.sale.domain.SaleItem;
import org.springframework.stereotype.Component;

@Component
public class PromissoryNoteMapper {

    private final CustomerMapper customerMapper;
    private final AuthMapper authMapper;

    public PromissoryNoteMapper(CustomerMapper customerMapper, AuthMapper authMapper) {
        this.customerMapper = customerMapper;
        this.authMapper = authMapper;
    }

    public PromissoryNoteResponse toResponse(PromissoryNote note) {
        return new PromissoryNoteResponse(
                note.getId(),
                note.getSale().getId(),
                customerMapper.toResponse(note.getCustomer()),
                note.getInstallmentNumber(),
                note.getTotalInstallments(),
                note.getAmount(),
                note.getDueDate(),
                note.getStatus(),
                note.getPaidAt(),
                note.getPaidBy() == null ? null : authMapper.toResponse(note.getPaidBy()),
                note.getPaymentMethod(),
                note.getCashRegister() == null ? null : note.getCashRegister().getId(),
                note.getCreatedAt(),
                note.getUpdatedAt(),
                note.getSale().getItems().stream().map(this::toSaleItemResponse).toList()
        );
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
