package com.iwr.pdv.product.mapper;

import com.iwr.pdv.product.api.dto.ProductRequest;
import com.iwr.pdv.product.api.dto.ProductResponse;
import com.iwr.pdv.product.domain.Product;
import java.time.OffsetDateTime;
import org.springframework.stereotype.Component;

@Component
public class ProductMapper {

    public Product toEntity(ProductRequest request, String code, OffsetDateTime now) {
        Product product = new Product();
        product.setName(request.name().trim());
        product.setCode(code);
        product.setPrice(request.price());
        product.setStockQuantity(request.stockQuantity());
        product.setActive(request.active());
        product.setCreatedAt(now);
        product.setUpdatedAt(now);

        return product;
    }

    public void updateEntity(Product product, ProductRequest request, String code, OffsetDateTime updatedAt) {
        product.setName(request.name().trim());
        product.setCode(code);
        product.setPrice(request.price());
        product.setStockQuantity(request.stockQuantity());
        product.setActive(request.active());
        product.setUpdatedAt(updatedAt);
    }

    public ProductResponse toResponse(Product product) {
        return new ProductResponse(
                product.getId(),
                product.getName(),
                product.getCode(),
                product.getPrice(),
                product.getStockQuantity(),
                product.getActive(),
                product.getCreatedAt(),
                product.getUpdatedAt()
        );
    }
}
