package com.iwr.pdv.sale.application;

import com.iwr.pdv.common.exception.BusinessRuleException;
import com.iwr.pdv.common.exception.ResourceNotFoundException;
import com.iwr.pdv.product.domain.Product;
import com.iwr.pdv.product.domain.ProductRepository;
import com.iwr.pdv.sale.api.dto.SaleItemRequest;
import com.iwr.pdv.sale.api.dto.SaleRequest;
import com.iwr.pdv.sale.api.dto.SaleResponse;
import com.iwr.pdv.sale.domain.Sale;
import com.iwr.pdv.sale.domain.SaleItem;
import com.iwr.pdv.sale.domain.SaleRepository;
import com.iwr.pdv.sale.domain.StockMovement;
import com.iwr.pdv.sale.domain.StockMovementRepository;
import com.iwr.pdv.sale.domain.StockMovementType;
import com.iwr.pdv.sale.mapper.SaleMapper;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SaleServiceImpl implements SaleService {

    private static final String SALE_REFERENCE_TYPE = "SALE";

    private final SaleRepository saleRepository;
    private final ProductRepository productRepository;
    private final StockMovementRepository stockMovementRepository;
    private final SaleMapper saleMapper;
    private final Clock clock;

    public SaleServiceImpl(
            SaleRepository saleRepository,
            ProductRepository productRepository,
            StockMovementRepository stockMovementRepository,
            SaleMapper saleMapper,
            Clock clock
    ) {
        this.saleRepository = saleRepository;
        this.productRepository = productRepository;
        this.stockMovementRepository = stockMovementRepository;
        this.saleMapper = saleMapper;
        this.clock = clock;
    }

    @Override
    @Transactional
    public SaleResponse closeSale(SaleRequest request) {
        Map<Long, Integer> quantitiesByProductId = consolidateQuantities(request.items());
        OffsetDateTime now = OffsetDateTime.now(clock);

        Sale sale = new Sale();
        sale.setSoldAt(now);
        sale.setCreatedAt(now);
        sale.setTotalAmount(BigDecimal.ZERO);

        for (Map.Entry<Long, Integer> entry : quantitiesByProductId.entrySet()) {
            Product product = findProduct(entry.getKey());
            int quantity = entry.getValue();

            validateProductCanBeSold(product, quantity);
            product.setStockQuantity(product.getStockQuantity() - quantity);
            product.setUpdatedAt(now);

            SaleItem item = saleMapper.toItem(product, quantity);
            sale.addItem(item);
            sale.setTotalAmount(sale.getTotalAmount().add(item.getSubtotal()));
        }

        Sale savedSale = saleRepository.save(sale);
        stockMovementRepository.saveAll(savedSale.getItems()
                .stream()
                .map(item -> toStockMovement(item, savedSale.getId(), now))
                .toList());

        return saleMapper.toResponse(savedSale);
    }

    @Override
    @Transactional(readOnly = true)
    public List<SaleResponse> list(LocalDate startDate, LocalDate endDate) {
        if (startDate == null && endDate == null) {
            return saleRepository.findAllByOrderBySoldAtDesc()
                    .stream()
                    .map(saleMapper::toResponse)
                    .toList();
        }

        LocalDate resolvedStart = startDate == null ? LocalDate.of(1970, 1, 1) : startDate;
        LocalDate resolvedEnd = endDate == null ? LocalDate.now(clock) : endDate;

        OffsetDateTime start = OffsetDateTime.of(resolvedStart, LocalTime.MIN, clock.getZone().getRules().getOffset(OffsetDateTime.now(clock).toInstant()));
        OffsetDateTime end = OffsetDateTime.of(resolvedEnd, LocalTime.MAX, clock.getZone().getRules().getOffset(OffsetDateTime.now(clock).toInstant()));

        return saleRepository.findBySoldAtBetweenOrderBySoldAtDesc(start, end)
                .stream()
                .map(saleMapper::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public SaleResponse findById(Long saleId) {
        return saleMapper.toResponse(saleRepository.findById(saleId)
                .orElseThrow(() -> new ResourceNotFoundException("Sale not found for id " + saleId + ".")));
    }

    private Map<Long, Integer> consolidateQuantities(List<SaleItemRequest> items) {
        Map<Long, Integer> quantitiesByProductId = new LinkedHashMap<>();

        for (SaleItemRequest item : items) {
            quantitiesByProductId.merge(item.productId(), item.quantity(), Integer::sum);
        }

        return quantitiesByProductId;
    }

    private Product findProduct(Long productId) {
        return productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found for id " + productId + "."));
    }

    private void validateProductCanBeSold(Product product, int quantity) {
        if (!Boolean.TRUE.equals(product.getActive())) {
            throw new BusinessRuleException("Product '" + product.getCode() + "' is inactive and cannot be sold.");
        }

        if (product.getStockQuantity() < quantity) {
            throw new BusinessRuleException(
                    "Product '" + product.getCode() + "' has insufficient stock. Available: "
                            + product.getStockQuantity() + "."
            );
        }
    }

    private StockMovement toStockMovement(SaleItem item, Long saleId, OffsetDateTime createdAt) {
        StockMovement movement = new StockMovement();
        movement.setProduct(item.getProduct());
        movement.setMovementType(StockMovementType.SALE);
        movement.setQuantityChange(item.getQuantity() * -1);
        movement.setReferenceType(SALE_REFERENCE_TYPE);
        movement.setReferenceId(saleId);
        movement.setCreatedAt(createdAt);

        return movement;
    }
}
