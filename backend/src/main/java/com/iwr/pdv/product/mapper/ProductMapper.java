package com.iwr.pdv.product.mapper;

import com.iwr.pdv.product.api.dto.ProductRequest;
import com.iwr.pdv.product.api.dto.ProductResponse;
import com.iwr.pdv.product.domain.Product;
import com.iwr.pdv.product.domain.ProductCategory;
import java.time.OffsetDateTime;
import java.math.BigDecimal;
import org.springframework.stereotype.Component;

@Component
public class ProductMapper {

    public Product toEntity(ProductRequest request, String code, ProductCategory category, OffsetDateTime now) {
        Product product = new Product();
        product.setName(request.name().trim());
        product.setCode(code);
        product.setCategory(category);
        product.setPrice(request.price());
        product.setCostPrice(request.costPrice() != null ? request.costPrice() : BigDecimal.ZERO);
        product.setStockQuantity(request.stockQuantity());
        product.setActive(request.active());
        product.setLotDate(request.lotDate());
        product.setCreatedAt(now);
        product.setUpdatedAt(now);

        return product;
    }

    public void updateEntity(
            Product product,
            ProductRequest request,
            String code,
            ProductCategory category,
            OffsetDateTime updatedAt
    ) {
        product.setName(request.name().trim());
        product.setCode(code);
        product.setCategory(category);
        product.setPrice(request.price());
        product.setCostPrice(request.costPrice() != null ? request.costPrice() : BigDecimal.ZERO);
        product.setStockQuantity(request.stockQuantity());
        product.setActive(request.active());
        product.setLotDate(request.lotDate());
        product.setUpdatedAt(updatedAt);
    }

    public ProductResponse toResponse(Product product) {
        return new ProductResponse(
                product.getId(),
                product.getName(),
                product.getCode(),
                product.getCategory().getId(),
                product.getCategory().getName(),
                product.getCategory().getIcon(),
                product.getPrice(),
                product.getCostPrice(),
                product.getStockQuantity(),
                product.getActive(),
                product.getLotDate(),
                product.getCreatedAt(),
                product.getUpdatedAt()
        );
    }
}
