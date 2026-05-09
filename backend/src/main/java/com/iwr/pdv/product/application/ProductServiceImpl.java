package com.iwr.pdv.product.application;

import com.iwr.pdv.common.exception.ResourceConflictException;
import com.iwr.pdv.common.exception.ResourceNotFoundException;
import com.iwr.pdv.product.api.dto.ProductActivationRequest;
import com.iwr.pdv.product.api.dto.ProductPageResponse;
import com.iwr.pdv.product.api.dto.ProductRequest;
import com.iwr.pdv.product.api.dto.ProductResponse;
import com.iwr.pdv.product.domain.Product;
import com.iwr.pdv.product.domain.ProductCategory;
import com.iwr.pdv.product.domain.ProductCategoryRepository;
import com.iwr.pdv.product.domain.ProductRepository;
import com.iwr.pdv.product.domain.ProductSearchRepository;
import com.iwr.pdv.product.mapper.ProductMapper;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Set;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class ProductServiceImpl implements ProductService {

    private static final int DEFAULT_LOW_STOCK_THRESHOLD = 5;
    private static final int MAX_PAGE_SIZE = 100;
    private static final Set<String> ALLOWED_SORT_FIELDS = Set.of(
            "name",
            "code",
            "price",
            "stockQuantity",
            "createdAt",
            "updatedAt"
    );

    private final ProductRepository productRepository;
    private final ProductCategoryRepository categoryRepository;
    private final ProductSearchRepository productSearchRepository;
    private final ProductMapper productMapper;
    private final ProductCodeGenerator productCodeGenerator;
    private final ProductQrCodeService productQrCodeService;
    private final ProductLabelService productLabelService;
    private final Clock clock;

    public ProductServiceImpl(
            ProductRepository productRepository,
            ProductCategoryRepository categoryRepository,
            ProductSearchRepository productSearchRepository,
            ProductMapper productMapper,
            ProductCodeGenerator productCodeGenerator,
            ProductQrCodeService productQrCodeService,
            ProductLabelService productLabelService,
            Clock clock
    ) {
        this.productRepository = productRepository;
        this.categoryRepository = categoryRepository;
        this.productSearchRepository = productSearchRepository;
        this.productMapper = productMapper;
        this.productCodeGenerator = productCodeGenerator;
        this.productQrCodeService = productQrCodeService;
        this.productLabelService = productLabelService;
        this.clock = clock;
    }

    @Override
    @Transactional
    public ProductResponse create(ProductRequest request) {
        String productCode = resolveCodeForCreate(request);
        ProductCategory category = findActiveCategory(request.categoryId());

        OffsetDateTime now = OffsetDateTime.now(clock);
        Product product = productMapper.toEntity(request, productCode, category, now);
        Product savedProduct = productRepository.save(product);

        return productMapper.toResponse(savedProduct);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductResponse> list(String search) {
        return productSearchRepository.findAllBySearch(search)
                .stream()
                .map(productMapper::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public ProductPageResponse listPage(
            String search,
            Boolean active,
            String stockStatus,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            Long categoryId,
            int lowStockThreshold,
            int page,
            int size,
            String sort,
            String direction
    ) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int safeLowStockThreshold = lowStockThreshold > 0 ? lowStockThreshold : DEFAULT_LOW_STOCK_THRESHOLD;
        String safeSort = ALLOWED_SORT_FIELDS.contains(sort) ? sort : "createdAt";
        Sort.Direction safeDirection = "asc".equalsIgnoreCase(direction) ? Sort.Direction.ASC : Sort.Direction.DESC;
        PageRequest pageRequest = PageRequest.of(safePage, safeSize, Sort.by(safeDirection, safeSort));

        Page<Product> products = productSearchRepository.findPageByFilters(
                search,
                active,
                stockStatus,
                minPrice,
                maxPrice,
                categoryId,
                safeLowStockThreshold,
                pageRequest
        );

        return new ProductPageResponse(
                products.getContent().stream().map(productMapper::toResponse).toList(),
                products.getNumber(),
                products.getSize(),
                products.getTotalElements(),
                products.getTotalPages(),
                products.isFirst(),
                products.isLast()
        );
    }

    @Override
    @Transactional(readOnly = true)
    public ProductResponse findById(Long productId) {
        return productMapper.toResponse(findProductById(productId));
    }

    @Override
    @Transactional(readOnly = true)
    public ProductResponse findByCodeForSale(String code) {
        if (!StringUtils.hasText(code)) {
            throw new ResourceNotFoundException("Product not found for code ''.");
        }

        Product product = productRepository.findByCodeIgnoreCase(code.trim())
                .orElseThrow(() -> new ResourceNotFoundException("Product not found for code " + code.trim() + "."));

        return productMapper.toResponse(product);
    }

    @Override
    @Transactional
    public ProductResponse update(Long productId, ProductRequest request) {
        Product existingProduct = findProductById(productId);
        String productCode = resolveCodeForUpdate(request, existingProduct);
        ProductCategory category = findActiveCategory(request.categoryId());

        productMapper.updateEntity(existingProduct, request, productCode, category, OffsetDateTime.now(clock));

        return productMapper.toResponse(productRepository.save(existingProduct));
    }

    @Override
    @Transactional
    public ProductResponse updateActivation(Long productId, ProductActivationRequest request) {
        Product existingProduct = findProductById(productId);
        existingProduct.setActive(request.active());
        existingProduct.setUpdatedAt(OffsetDateTime.now(clock));

        return productMapper.toResponse(productRepository.save(existingProduct));
    }

    @Override
    @Transactional(readOnly = true)
    public byte[] generateQrCode(Long productId) {
        Product product = findProductById(productId);
        return productQrCodeService.generateQrCode(product.getCode());
    }

    @Override
    @Transactional(readOnly = true)
    public String generateLabel(Long productId) {
        Product product = findProductById(productId);
        return productLabelService.generateLabel(product);
    }

    @Override
    @Transactional(readOnly = true)
    public String generateLabels(List<Long> productIds) {
        if (productIds == null || productIds.isEmpty()) {
            throw new com.iwr.pdv.common.exception.BusinessRuleException("Select at least one product to print labels.");
        }

        List<Product> products = productIds.stream()
                .map(this::findProductById)
                .toList();

        StringBuilder labelsHtml = new StringBuilder();
        for (Product product : products) {
            int quantity = Math.max(product.getStockQuantity(), 1);
            for (int i = 0; i < quantity; i++) {
                labelsHtml.append(productLabelService.generateLabel(product));
            }
        }

        return """
                <!doctype html>
                <html lang="pt-BR">
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <title>Etiquetas de Produtos</title>
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
                    }
                  </style>
                </head>
                <body>
                  <header class="toolbar">
                    <strong>%d produto(s) selecionados</strong>
                    <button onclick="window.print()">Imprimir etiquetas</button>
                  </header>
                  <main class="sheet">%s</main>
                </body>
                </html>
                """.formatted(products.size(), labelsHtml);
    }

    private Product findProductById(Long productId) {
        return productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found for id " + productId + "."));
    }

    private ProductCategory findActiveCategory(Long categoryId) {
        ProductCategory category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new ResourceNotFoundException("Product category not found for id " + categoryId + "."));

        if (!Boolean.TRUE.equals(category.getActive())) {
            throw new ResourceNotFoundException("Product category not found for id " + categoryId + ".");
        }

        return category;
    }

    private void ensureCodeIsUnique(String code, Long currentProductId) {
        productRepository.findByCodeIgnoreCase(code.trim())
                .filter(product -> !product.getId().equals(currentProductId))
                .ifPresent(product -> {
                    throw new ResourceConflictException("A product with code '" + code.trim() + "' already exists.");
                });
    }

    private String resolveCodeForCreate(ProductRequest request) {
        if (!StringUtils.hasText(request.code())) {
            return generateUniqueAutomaticCode();
        }

        ensureCodeIsUnique(request.code(), null);
        return request.code().trim().toUpperCase();
    }

    private String resolveCodeForUpdate(ProductRequest request, Product existingProduct) {
        if (!StringUtils.hasText(request.code())) {
            return existingProduct.getCode();
        }

        ensureCodeIsUnique(request.code(), existingProduct.getId());
        return request.code().trim().toUpperCase();
    }

    private String generateUniqueAutomaticCode() {
        String generatedCode = productCodeGenerator.generateNextCode();

        while (productRepository.findByCodeIgnoreCase(generatedCode).isPresent()) {
            generatedCode = productCodeGenerator.generateNextCode();
        }

        return generatedCode;
    }
}
