package com.iwr.pdv.product.application;

import com.iwr.pdv.common.exception.ResourceConflictException;
import com.iwr.pdv.common.exception.ResourceNotFoundException;
import com.iwr.pdv.product.api.dto.ProductActivationRequest;
import com.iwr.pdv.product.api.dto.ProductRequest;
import com.iwr.pdv.product.api.dto.ProductResponse;
import com.iwr.pdv.product.domain.Product;
import com.iwr.pdv.product.domain.ProductRepository;
import com.iwr.pdv.product.domain.ProductSearchRepository;
import com.iwr.pdv.product.mapper.ProductMapper;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class ProductServiceImpl implements ProductService {

    private final ProductRepository productRepository;
    private final ProductSearchRepository productSearchRepository;
    private final ProductMapper productMapper;
    private final ProductCodeGenerator productCodeGenerator;
    private final ProductQrCodeService productQrCodeService;
    private final Clock clock;

    public ProductServiceImpl(
            ProductRepository productRepository,
            ProductSearchRepository productSearchRepository,
            ProductMapper productMapper,
            ProductCodeGenerator productCodeGenerator,
            ProductQrCodeService productQrCodeService,
            Clock clock
    ) {
        this.productRepository = productRepository;
        this.productSearchRepository = productSearchRepository;
        this.productMapper = productMapper;
        this.productCodeGenerator = productCodeGenerator;
        this.productQrCodeService = productQrCodeService;
        this.clock = clock;
    }

    @Override
    @Transactional
    public ProductResponse create(ProductRequest request) {
        String productCode = resolveCodeForCreate(request);

        OffsetDateTime now = OffsetDateTime.now(clock);
        Product product = productMapper.toEntity(request, productCode, now);
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
    public ProductResponse findById(Long productId) {
        return productMapper.toResponse(findProductById(productId));
    }

    @Override
    @Transactional
    public ProductResponse update(Long productId, ProductRequest request) {
        Product existingProduct = findProductById(productId);
        String productCode = resolveCodeForUpdate(request, existingProduct);

        productMapper.updateEntity(existingProduct, request, productCode, OffsetDateTime.now(clock));

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

    private Product findProductById(Long productId) {
        return productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found for id " + productId + "."));
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
