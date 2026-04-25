package com.iwr.pdv.sale.application;

import com.iwr.pdv.auth.domain.AppUser;
import com.iwr.pdv.cash.application.CashRegisterService;
import com.iwr.pdv.cash.domain.CashRegister;
import com.iwr.pdv.common.exception.BusinessRuleException;
import com.iwr.pdv.common.exception.ResourceNotFoundException;
import com.iwr.pdv.product.domain.Product;
import com.iwr.pdv.product.domain.ProductRepository;
import com.iwr.pdv.sale.api.dto.SaleCancellationRequest;
import com.iwr.pdv.sale.api.dto.SaleItemRequest;
import com.iwr.pdv.sale.api.dto.SaleRequest;
import com.iwr.pdv.sale.api.dto.SaleResponse;
import com.iwr.pdv.sale.domain.PaymentMethod;
import com.iwr.pdv.sale.domain.Sale;
import com.iwr.pdv.sale.domain.SaleItem;
import com.iwr.pdv.sale.domain.SaleRepository;
import com.iwr.pdv.sale.domain.SaleStatus;
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
    private final CashRegisterService cashRegisterService;
    private final Clock clock;

    public SaleServiceImpl(
            SaleRepository saleRepository,
            ProductRepository productRepository,
            StockMovementRepository stockMovementRepository,
            SaleMapper saleMapper,
            CashRegisterService cashRegisterService,
            Clock clock
    ) {
        this.saleRepository = saleRepository;
        this.productRepository = productRepository;
        this.stockMovementRepository = stockMovementRepository;
        this.saleMapper = saleMapper;
        this.cashRegisterService = cashRegisterService;
        this.clock = clock;
    }

    @Override
    @Transactional
    public SaleResponse closeSale(SaleRequest request, AppUser operator) {
        Map<Long, Integer> quantitiesByProductId = consolidateQuantities(request.items());
        OffsetDateTime now = OffsetDateTime.now(clock);
        CashRegister cashRegister = cashRegisterService.requireOpenRegister();

        Sale sale = new Sale();
        sale.setSoldAt(now);
        sale.setCreatedAt(now);
        sale.setStatus(SaleStatus.COMPLETED);
        sale.setOperator(operator);
        sale.setCashRegister(cashRegister);
        sale.setPaymentMethod(request.paymentMethod());
        sale.setSubtotalAmount(BigDecimal.ZERO);
        sale.setDiscountAmount(resolveDiscount(request.discountAmount()));
        sale.setTotalAmount(BigDecimal.ZERO);
        sale.setChangeAmount(BigDecimal.ZERO);

        for (Map.Entry<Long, Integer> entry : quantitiesByProductId.entrySet()) {
            Product product = findProduct(entry.getKey());
            int quantity = entry.getValue();

            validateProductCanBeSold(product, quantity);
            product.setStockQuantity(product.getStockQuantity() - quantity);
            product.setUpdatedAt(now);

            SaleItem item = saleMapper.toItem(product, quantity);
            sale.addItem(item);
            sale.setSubtotalAmount(sale.getSubtotalAmount().add(item.getSubtotal()));
        }

        validateDiscount(sale.getSubtotalAmount(), sale.getDiscountAmount());
        sale.setTotalAmount(sale.getSubtotalAmount().subtract(sale.getDiscountAmount()));
        applyPaymentAmounts(sale, request.amountReceived());

        Sale savedSale = saleRepository.save(sale);
        stockMovementRepository.saveAll(savedSale.getItems()
                .stream()
                .map(item -> toStockMovement(item, savedSale.getId(), now, StockMovementType.SALE))
                .toList());

        return saleMapper.toResponse(savedSale);
    }

    @Override
    @Transactional
    public SaleResponse cancel(Long saleId, SaleCancellationRequest request, AppUser operator) {
        Sale sale = saleRepository.findById(saleId)
                .orElseThrow(() -> new ResourceNotFoundException("Sale not found for id " + saleId + "."));

        if (sale.getStatus() == SaleStatus.CANCELLED) {
            throw new BusinessRuleException("Sale is already cancelled.");
        }

        OffsetDateTime now = OffsetDateTime.now(clock);
        sale.setStatus(SaleStatus.CANCELLED);
        sale.setCancelledBy(operator);
        sale.setCancellationReason(request.reason().trim());
        sale.setCancelledAt(now);

        for (SaleItem item : sale.getItems()) {
            Product product = item.getProduct();
            product.setStockQuantity(product.getStockQuantity() + item.getQuantity());
            product.setUpdatedAt(now);
        }

        stockMovementRepository.saveAll(sale.getItems()
                .stream()
                .map(item -> toStockMovement(item, sale.getId(), now, StockMovementType.SALE_CANCELLATION))
                .toList());

        return saleMapper.toResponse(sale);
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

    @Override
    @Transactional(readOnly = true)
    public String generateReceipt(Long saleId) {
        Sale sale = saleRepository.findById(saleId)
                .orElseThrow(() -> new ResourceNotFoundException("Sale not found for id " + saleId + "."));

        StringBuilder itemsHtml = new StringBuilder();
        for (SaleItem item : sale.getItems()) {
            itemsHtml.append("""
                    <tr>
                      <td>%s<br><small>%s</small></td>
                      <td>%d</td>
                      <td>%s</td>
                      <td>%s</td>
                    </tr>
                    """.formatted(
                    escape(item.getProductName()),
                    escape(item.getProductCode()),
                    item.getQuantity(),
                    formatMoney(item.getUnitPrice()),
                    formatMoney(item.getSubtotal())
            ));
        }

        return """
                <!doctype html>
                <html lang="pt-BR">
                <head>
                  <meta charset="utf-8">
                  <title>Recibo Venda #%d</title>
                  <style>
                    body{font-family:Arial,sans-serif;margin:24px;color:#111827}
                    .receipt{max-width:420px;margin:0 auto}
                    h1{font-size:22px;margin:0 0 4px}
                    .muted{color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.08em}
                    table{width:100%%;border-collapse:collapse;margin:18px 0}
                    th,td{border-bottom:1px solid #e5e7eb;padding:8px;text-align:left;font-size:13px}
                    th{text-transform:uppercase;font-size:11px;color:#6b7280}
                    .totals{display:grid;gap:8px}
                    .row{display:flex;justify-content:space-between}
                    .total{font-weight:700;font-size:18px}
                    @media print{button{display:none}body{margin:0}.receipt{max-width:none}}
                  </style>
                </head>
                <body>
                  <main class="receipt">
                    <p class="muted">Recibo nao fiscal</p>
                    <h1>IWR Modas</h1>
                    <p>Venda #%d<br>Data: %s<br>Operador: %s<br>Status: %s</p>
                    <table>
                      <thead><tr><th>Produto</th><th>Qtd</th><th>Unit.</th><th>Total</th></tr></thead>
                      <tbody>%s</tbody>
                    </table>
                    <section class="totals">
                      <div class="row"><span>Subtotal</span><strong>%s</strong></div>
                      <div class="row"><span>Desconto</span><strong>%s</strong></div>
                      <div class="row total"><span>Total</span><strong>%s</strong></div>
                      <div class="row"><span>Pagamento</span><strong>%s</strong></div>
                      %s
                    </section>
                    %s
                    <p class="muted">Obrigado pela preferencia.</p>
                    <button onclick="window.print()">Imprimir</button>
                  </main>
                </body>
                </html>
                """.formatted(
                sale.getId(),
                sale.getId(),
                sale.getSoldAt(),
                escape(sale.getOperator().getDisplayName()),
                sale.getStatus(),
                itemsHtml,
                formatMoney(sale.getSubtotalAmount()),
                formatMoney(sale.getDiscountAmount()),
                formatMoney(sale.getTotalAmount()),
                sale.getPaymentMethod(),
                sale.getPaymentMethod() == PaymentMethod.CASH
                        ? "<div class=\"row\"><span>Recebido</span><strong>" + formatMoney(sale.getAmountReceived()) + "</strong></div><div class=\"row\"><span>Troco</span><strong>" + formatMoney(sale.getChangeAmount()) + "</strong></div>"
                        : "",
                sale.getStatus() == SaleStatus.CANCELLED
                        ? "<p>Cancelada em " + sale.getCancelledAt() + "<br>Motivo: " + escape(sale.getCancellationReason()) + "</p>"
                        : ""
        );
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

    private BigDecimal resolveDiscount(BigDecimal discountAmount) {
        return discountAmount == null ? BigDecimal.ZERO : discountAmount;
    }

    private void validateDiscount(BigDecimal subtotalAmount, BigDecimal discountAmount) {
        if (discountAmount.compareTo(subtotalAmount) > 0) {
            throw new BusinessRuleException("Discount amount cannot be greater than sale subtotal.");
        }
    }

    private void applyPaymentAmounts(Sale sale, BigDecimal amountReceived) {
        if (sale.getPaymentMethod() == PaymentMethod.CASH) {
            if (amountReceived == null || amountReceived.compareTo(sale.getTotalAmount()) < 0) {
                throw new BusinessRuleException("Cash received amount must be greater than or equal to sale total.");
            }
            sale.setAmountReceived(amountReceived);
            sale.setChangeAmount(amountReceived.subtract(sale.getTotalAmount()));
            return;
        }

        sale.setAmountReceived(null);
        sale.setChangeAmount(BigDecimal.ZERO);
    }

    private StockMovement toStockMovement(
            SaleItem item,
            Long saleId,
            OffsetDateTime createdAt,
            StockMovementType movementType
    ) {
        StockMovement movement = new StockMovement();
        movement.setProduct(item.getProduct());
        movement.setMovementType(movementType);
        movement.setQuantityChange(movementType == StockMovementType.SALE ? item.getQuantity() * -1 : item.getQuantity());
        movement.setReferenceType(SALE_REFERENCE_TYPE);
        movement.setReferenceId(saleId);
        movement.setCreatedAt(createdAt);

        return movement;
    }

    private String formatMoney(BigDecimal value) {
        return "R$ " + (value == null ? BigDecimal.ZERO : value).setScale(2).toString().replace(".", ",");
    }

    private String escape(String value) {
        if (value == null) {
            return "";
        }

        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }
}
