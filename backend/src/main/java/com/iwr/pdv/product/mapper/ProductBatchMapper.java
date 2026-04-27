package com.iwr.pdv.product.mapper;

import com.iwr.pdv.auth.mapper.AuthMapper;
import com.iwr.pdv.product.api.dto.ProductBatchResponse;
import com.iwr.pdv.product.domain.Product;
import com.iwr.pdv.product.domain.ProductBatch;
import org.springframework.stereotype.Component;

@Component
public class ProductBatchMapper {

    private final AuthMapper authMapper;
    private final ProductMapper productMapper;

    public ProductBatchMapper(AuthMapper authMapper, ProductMapper productMapper) {
        this.authMapper = authMapper;
        this.productMapper = productMapper;
    }

    public ProductBatchResponse toResponse(ProductBatch batch) {
        return new ProductBatchResponse(
                batch.getId(),
                batch.getName(),
                batch.getStatus(),
                batch.getProducts().size(),
                batch.getProducts().stream().mapToInt(Product::getStockQuantity).sum(),
                authMapper.toResponse(batch.getCreatedBy()),
                batch.getLabelsPrintedAt(),
                batch.getCatalogedAt(),
                batch.getSentToStoreAt(),
                batch.getStoreShipmentNote(),
                batch.getCreatedAt(),
                batch.getUpdatedAt(),
                batch.getProducts().stream().map(productMapper::toResponse).toList()
        );
    }
}
