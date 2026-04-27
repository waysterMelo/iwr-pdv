package com.iwr.pdv.product.application;

import com.iwr.pdv.auth.domain.AppUser;
import com.iwr.pdv.common.exception.BusinessRuleException;
import com.iwr.pdv.common.exception.ResourceConflictException;
import com.iwr.pdv.common.exception.ResourceNotFoundException;
import com.iwr.pdv.product.api.dto.ProductBatchCreateRequest;
import com.iwr.pdv.product.api.dto.ProductBatchItemRequest;
import com.iwr.pdv.product.api.dto.ProductBatchResponse;
import com.iwr.pdv.product.api.dto.ProductBatchStoreShipmentRequest;
import com.iwr.pdv.product.domain.Product;
import com.iwr.pdv.product.domain.ProductBatch;
import com.iwr.pdv.product.domain.ProductBatchRepository;
import com.iwr.pdv.product.domain.ProductBatchStatus;
import com.iwr.pdv.product.domain.ProductCategory;
import com.iwr.pdv.product.domain.ProductCategoryRepository;
import com.iwr.pdv.product.domain.ProductRepository;
import com.iwr.pdv.product.mapper.ProductBatchMapper;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class ProductBatchServiceImpl implements ProductBatchService {

    private static final Locale BRAZIL = Locale.of("pt", "BR");

    private final ProductBatchRepository batchRepository;
    private final ProductRepository productRepository;
    private final ProductCategoryRepository categoryRepository;
    private final ProductCodeGenerator productCodeGenerator;
    private final ProductQrCodeService productQrCodeService;
    private final ProductBatchMapper batchMapper;
    private final Clock clock;

    public ProductBatchServiceImpl(
            ProductBatchRepository batchRepository,
            ProductRepository productRepository,
            ProductCategoryRepository categoryRepository,
            ProductCodeGenerator productCodeGenerator,
            ProductQrCodeService productQrCodeService,
            ProductBatchMapper batchMapper,
            Clock clock
    ) {
        this.batchRepository = batchRepository;
        this.productRepository = productRepository;
        this.categoryRepository = categoryRepository;
        this.productCodeGenerator = productCodeGenerator;
        this.productQrCodeService = productQrCodeService;
        this.batchMapper = batchMapper;
        this.clock = clock;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductBatchResponse> list() {
        return batchRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(batchMapper::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public ProductBatchResponse findById(Long batchId) {
        return batchMapper.toResponse(findBatch(batchId));
    }

    @Override
    @Transactional
    public ProductBatchResponse create(ProductBatchCreateRequest request, AppUser operator) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        ProductBatch batch = new ProductBatch();
        batch.setName(request.name().trim());
        batch.setStatus(ProductBatchStatus.DRAFT);
        batch.setCreatedBy(operator);
        batch.setCreatedAt(now);
        batch.setUpdatedAt(now);

        Set<String> usedCodesInBatch = new HashSet<>();
        for (ProductBatchItemRequest item : request.items()) {
            Product product = toProduct(item, usedCodesInBatch, now);
            batch.addProduct(product);
        }

        return batchMapper.toResponse(batchRepository.save(batch));
    }

    @Override
    @Transactional
    public ProductBatchResponse markLabelsPrinted(Long batchId) {
        ProductBatch batch = findBatch(batchId);
        OffsetDateTime now = OffsetDateTime.now(clock);
        batch.setLabelsPrintedAt(now);
        batch.setStatus(ProductBatchStatus.LABELS_PRINTED);
        batch.setUpdatedAt(now);
        return batchMapper.toResponse(batch);
    }

    @Override
    @Transactional
    public ProductBatchResponse markCataloged(Long batchId) {
        ProductBatch batch = findBatch(batchId);
        OffsetDateTime now = OffsetDateTime.now(clock);
        batch.setCatalogedAt(now);
        batch.setStatus(ProductBatchStatus.CATALOGED);
        batch.setUpdatedAt(now);
        return batchMapper.toResponse(batch);
    }

    @Override
    @Transactional
    public ProductBatchResponse markSentToStore(Long batchId, ProductBatchStoreShipmentRequest request) {
        ProductBatch batch = findBatch(batchId);

        if (batch.getCatalogedAt() == null) {
            throw new BusinessRuleException("Catalog the batch before sending it to the store.");
        }

        OffsetDateTime now = OffsetDateTime.now(clock);
        batch.setSentToStoreAt(request.sentToStoreAt());
        batch.setStoreShipmentNote(StringUtils.hasText(request.note()) ? request.note().trim() : null);
        batch.setStatus(ProductBatchStatus.SENT_TO_STORE);
        batch.setUpdatedAt(now);
        return batchMapper.toResponse(batch);
    }

    @Override
    @Transactional(readOnly = true)
    public String generateLabels(Long batchId) {
        ProductBatch batch = findBatch(batchId);
        StringBuilder labelsHtml = new StringBuilder();

        for (Product product : batch.getProducts()) {
            int quantity = Math.max(product.getStockQuantity(), 1);
            for (int index = 0; index < quantity; index++) {
                labelsHtml.append(renderLabel(product));
            }
        }

        return """
                <!doctype html>
                <html lang="pt-BR">
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <title>Etiquetas Lote #%d</title>
                  <style>
                    @page { size: 50mm 30mm; margin: 0; }
                    * { box-sizing: border-box; }
                    body {
                      margin: 0;
                      background: #f3f4f6;
                      color: #111827;
                      font-family: Arial, sans-serif;
                    }
                    .sheet {
                      display: flex;
                      flex-wrap: wrap;
                      gap: 6mm;
                      padding: 8mm;
                    }
                    .label {
                      width: 50mm;
                      height: 30mm;
                      display: grid;
                      grid-template-columns: minmax(0, 1fr) 21mm;
                      gap: 2mm;
                      align-items: center;
                      padding: 2.4mm;
                      background: #fff;
                      border: 1px solid #d1d5db;
                      page-break-inside: avoid;
                    }
                    .brand {
                      margin: 0 0 1.1mm;
                      font-size: 6.4pt;
                      font-weight: 800;
                      letter-spacing: 0.45pt;
                      color: #4b5563;
                    }
                    .name {
                      margin: 0 0 1.3mm;
                      max-height: 8mm;
                      overflow: hidden;
                      font-size: 7.4pt;
                      line-height: 1.12;
                      font-weight: 700;
                      word-break: break-word;
                    }
                    .price {
                      margin: 0 0 1.1mm;
                      font-size: 12.4pt;
                      line-height: 1;
                      font-weight: 900;
                    }
                    .qr-frame {
                      width: 21mm;
                      height: 21mm;
                      display: grid;
                      place-items: center;
                      padding: 1.5mm;
                      background: #fff;
                    }
                    img {
                      width: 18mm;
                      height: 18mm;
                      display: block;
                      object-fit: contain;
                    }
                    .toolbar {
                      position: sticky;
                      top: 0;
                      display: flex;
                      justify-content: space-between;
                      gap: 16px;
                      padding: 12px 16px;
                      background: #111827;
                      color: #fff;
                    }
                    button {
                      border: 1px solid #fff;
                      background: #fff;
                      color: #111827;
                      padding: 8px 12px;
                      font-weight: 800;
                      cursor: pointer;
                    }
                    @media print {
                      body { background: #fff; }
                      .toolbar { display: none; }
                      .sheet { display: block; padding: 0; }
                      .label { border: 0; break-after: page; }
                    }
                  </style>
                </head>
                <body>
                  <header class="toolbar">
                    <strong>Lote #%d - %s</strong>
                    <button onclick="window.print()">Imprimir etiquetas</button>
                  </header>
                  <main class="sheet">%s</main>
                </body>
                </html>
                """.formatted(
                batch.getId(),
                batch.getId(),
                escapeHtml(batch.getName()),
                labelsHtml
        );
    }

    private Product toProduct(ProductBatchItemRequest item, Set<String> usedCodesInBatch, OffsetDateTime now) {
        String code = resolveProductCode(item.code(), usedCodesInBatch);
        ProductCategory category = findActiveCategory(item.categoryId());

        Product product = new Product();
        product.setName(item.name().trim());
        product.setCode(code);
        product.setCategory(category);
        product.setPrice(item.price());
        product.setStockQuantity(item.stockQuantity());
        product.setActive(item.active());
        product.setCreatedAt(now);
        product.setUpdatedAt(now);

        return product;
    }

    private String resolveProductCode(String code, Set<String> usedCodesInBatch) {
        if (!StringUtils.hasText(code)) {
            String generatedCode = productCodeGenerator.generateNextCode();
            while (productRepository.findByCodeIgnoreCase(generatedCode).isPresent()
                    || !usedCodesInBatch.add(generatedCode)) {
                generatedCode = productCodeGenerator.generateNextCode();
            }
            return generatedCode;
        }

        String normalizedCode = code.trim().toUpperCase();
        if (!usedCodesInBatch.add(normalizedCode)
                || productRepository.findByCodeIgnoreCase(normalizedCode).isPresent()) {
            throw new ResourceConflictException("A product with code '" + normalizedCode + "' already exists.");
        }

        return normalizedCode;
    }

    private ProductCategory findActiveCategory(Long categoryId) {
        ProductCategory category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new ResourceNotFoundException("Product category not found for id " + categoryId + "."));

        if (!Boolean.TRUE.equals(category.getActive())) {
            throw new ResourceNotFoundException("Product category not found for id " + categoryId + ".");
        }

        return category;
    }

    private ProductBatch findBatch(Long batchId) {
        return batchRepository.findById(batchId)
                .orElseThrow(() -> new ResourceNotFoundException("Product batch not found for id " + batchId + "."));
    }

    private String renderLabel(Product product) {
        String encodedQrCode = Base64.getEncoder()
                .encodeToString(productQrCodeService.generateQrCode(product.getCode()));

        return """
                <section class="label" aria-label="Etiqueta de produto">
                  <div class="content">
                    <p class="brand">IWR MODAS</p>
                    <p class="name">%s</p>
                    <p class="price">%s</p>
                  </div>
                  <div class="qr-frame" aria-label="QR Code do produto">
                    <img src="data:image/png;base64,%s" alt="QR Code do produto">
                  </div>
                </section>
                """.formatted(
                escapeHtml(product.getName()),
                escapeHtml(formatCurrency(product)),
                encodedQrCode
        );
    }

    private String formatCurrency(Product product) {
        NumberFormat formatter = NumberFormat.getCurrencyInstance(BRAZIL);
        return formatter.format(product.getPrice().setScale(2, RoundingMode.HALF_UP));
    }

    private String escapeHtml(String value) {
        return value == null ? "" : value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
