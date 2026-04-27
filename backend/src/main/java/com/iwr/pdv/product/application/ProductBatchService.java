package com.iwr.pdv.product.application;

import com.iwr.pdv.auth.domain.AppUser;
import com.iwr.pdv.product.api.dto.ProductBatchCreateRequest;
import com.iwr.pdv.product.api.dto.ProductBatchResponse;
import com.iwr.pdv.product.api.dto.ProductBatchStoreShipmentRequest;
import java.util.List;

public interface ProductBatchService {

    List<ProductBatchResponse> list();

    ProductBatchResponse findById(Long batchId);

    ProductBatchResponse create(ProductBatchCreateRequest request, AppUser operator);

    ProductBatchResponse markLabelsPrinted(Long batchId);

    ProductBatchResponse markCataloged(Long batchId);

    ProductBatchResponse markSentToStore(Long batchId, ProductBatchStoreShipmentRequest request);

    String generateLabels(Long batchId);
}
