package com.iwr.pdv.product.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.iwr.pdv.common.exception.BusinessRuleException;
import com.iwr.pdv.common.exception.ResourceConflictException;
import com.iwr.pdv.common.exception.ResourceNotFoundException;
import com.iwr.pdv.product.api.dto.ProductActivationRequest;
import com.iwr.pdv.product.api.dto.ProductRequest;
import com.iwr.pdv.product.api.dto.ProductResponse;
import com.iwr.pdv.product.domain.Product;
import com.iwr.pdv.product.domain.ProductCategory;
import com.iwr.pdv.product.domain.ProductCategoryRepository;
import com.iwr.pdv.product.domain.ProductRepository;
import com.iwr.pdv.product.domain.ProductSearchRepository;
import com.iwr.pdv.product.mapper.ProductMapper;
import java.nio.charset.StandardCharsets;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ProductServiceImplTest {

    @Mock
    private ProductRepository productRepository;

    @Mock
    private ProductCategoryRepository categoryRepository;

    @Mock
    private ProductSearchRepository productSearchRepository;

    @Mock
    private ProductCodeGenerator productCodeGenerator;

    @Mock
    private ProductBarcodeService productBarcodeService;

    @Mock
    private ProductLabelService productLabelService;

    private ProductService productService;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(Instant.parse("2026-04-22T00:00:00Z"), ZoneOffset.UTC);
        productService = new ProductServiceImpl(
                productRepository,
                categoryRepository,
                productSearchRepository,
                new ProductMapper(),
                productCodeGenerator,
                productBarcodeService,
                productLabelService,
                clock
        );
    }

    @Test
    void shouldCreateProductWhenCodeIsAvailable() {
        ProductRequest request = new ProductRequest(
                "Camisa Polo",
                "iwr-001",
                1L,
                new BigDecimal("79.90"),
                12,
                true
        );

        when(productRepository.findByCodeIgnoreCase("iwr-001")).thenReturn(Optional.empty());
        when(categoryRepository.findById(1L)).thenReturn(Optional.of(category()));
        when(productRepository.save(any(Product.class))).thenAnswer(invocation -> {
            Product product = invocation.getArgument(0);
            product.setId(1L);
            return product;
        });

        ProductResponse response = productService.create(request);

        assertEquals(1L, response.id());
        assertEquals("Camisa Polo", response.name());
        assertEquals("IWR-001", response.code());
        assertEquals(new BigDecimal("79.90"), response.price());
    }

    @Test
    void shouldGenerateCodeAutomaticallyWhenCodeIsBlank() {
        ProductRequest request = new ProductRequest(
                "Vestido Midi",
                "",
                1L,
                new BigDecimal("149.90"),
                8,
                true
        );

        when(productCodeGenerator.generateNextCode()).thenReturn("IWR-000001");
        when(productRepository.findByCodeIgnoreCase("IWR-000001")).thenReturn(Optional.empty());
        when(categoryRepository.findById(1L)).thenReturn(Optional.of(category()));
        when(productRepository.save(any(Product.class))).thenAnswer(invocation -> {
            Product product = invocation.getArgument(0);
            product.setId(1L);
            return product;
        });

        ProductResponse response = productService.create(request);

        assertEquals("IWR-000001", response.code());
    }

    @Test
    void shouldSkipAutomaticCodeWhenItAlreadyExists() {
        ProductRequest request = new ProductRequest(
                "Vestido Midi",
                "",
                1L,
                new BigDecimal("149.90"),
                8,
                true
        );

        Product existingProduct = new Product();
        existingProduct.setId(10L);
        existingProduct.setCode("IWR-000001");

        when(productCodeGenerator.generateNextCode()).thenReturn("IWR-000001", "IWR-000002");
        when(productRepository.findByCodeIgnoreCase("IWR-000001")).thenReturn(Optional.of(existingProduct));
        when(productRepository.findByCodeIgnoreCase("IWR-000002")).thenReturn(Optional.empty());
        when(categoryRepository.findById(1L)).thenReturn(Optional.of(category()));
        when(productRepository.save(any(Product.class))).thenAnswer(invocation -> {
            Product product = invocation.getArgument(0);
            product.setId(11L);
            return product;
        });

        ProductResponse response = productService.create(request);

        assertEquals("IWR-000002", response.code());
    }

    @Test
    void shouldRejectCreateWhenCodeAlreadyExists() {
        ProductRequest request = new ProductRequest(
                "Camisa Polo",
                "iwr-001",
                1L,
                new BigDecimal("79.90"),
                12,
                true
        );

        Product existingProduct = new Product();
        existingProduct.setId(5L);
        existingProduct.setCode("IWR-001");

        when(productRepository.findByCodeIgnoreCase("iwr-001")).thenReturn(Optional.of(existingProduct));

        assertThrows(ResourceConflictException.class, () -> productService.create(request));
        verify(productRepository, never()).save(any(Product.class));
    }

    @Test
    void shouldFilterProductsBySearch() {
        Product product = new Product();
        product.setId(2L);
        product.setName("Vestido Midi");
        product.setCode("IWR-010");
        product.setCategory(category());
        product.setPrice(new BigDecimal("149.90"));
        product.setStockQuantity(8);
        product.setActive(true);

        when(productSearchRepository.findAllBySearch("midi")).thenReturn(List.of(product));

        List<ProductResponse> products = productService.list("midi");

        assertEquals(1, products.size());
        assertEquals("Vestido Midi", products.getFirst().name());
    }

    @Test
    void shouldUpdateActivationStatus() {
        Product product = new Product();
        product.setId(7L);
        product.setName("Saia Jeans");
        product.setCode("IWR-020");
        product.setCategory(category());
        product.setPrice(new BigDecimal("99.90"));
        product.setStockQuantity(3);
        product.setActive(true);

        when(productRepository.findById(7L)).thenReturn(Optional.of(product));
        when(productRepository.save(any(Product.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ProductResponse response = productService.updateActivation(7L, new ProductActivationRequest(false));

        assertEquals(false, response.active());
    }

    @Test
    void shouldThrowWhenProductDoesNotExist() {
        when(productRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> productService.findById(99L));
    }

    @Test
    void shouldFindProductByNumericCodeSuffixForSale() {
        Product product = new Product();
        product.setId(11L);
        product.setName("Vestido Midi");
        product.setCode("IWR-000011");
        product.setCategory(category());
        product.setPrice(new BigDecimal("149.90"));
        product.setStockQuantity(8);
        product.setActive(true);

        when(productRepository.findByCodeIgnoreCase("000011")).thenReturn(Optional.empty());
        when(productRepository.findByCodeEndingWith("000011")).thenReturn(Optional.of(product));

        ProductResponse response = productService.findByCodeForSale("000011");

        assertEquals("IWR-000011", response.code());
    }

    @Test
    void shouldGenerateBarcodeFromProductCode() {
        Product product = new Product();
        product.setId(8L);
        product.setCode("IWR-000008");

        when(productRepository.findById(8L)).thenReturn(Optional.of(product));
        when(productBarcodeService.generateBarcode("IWR-000008"))
                .thenReturn("barcode".getBytes(StandardCharsets.UTF_8));

        byte[] barcode = productService.generateBarcode(8L);

        assertEquals("barcode", new String(barcode, StandardCharsets.UTF_8));
    }

    @Test
    void shouldGeneratePrintableLabelFromProduct() {
        Product product = new Product();
        product.setId(9L);
        product.setName("Vestido Midi");
        product.setCode("IWR-000009");

        when(productRepository.findById(9L)).thenReturn(Optional.of(product));
        when(productLabelService.generateLabel(product)).thenReturn("<html>label</html>");

        String label = productService.generateLabel(9L);

        assertEquals("<html>label</html>", label);
    }

    @Test
    void shouldGenerateBulkLabelsOnlyForProductsWithStock() {
        Product inStockProduct = product("Vestido Midi", "IWR-000010", 2);
        Product outOfStockProduct = product("Blusa Linho", "IWR-000011", 0);

        when(productRepository.findById(10L)).thenReturn(Optional.of(inStockProduct));
        when(productRepository.findById(11L)).thenReturn(Optional.of(outOfStockProduct));
        when(productLabelService.generateLabel(inStockProduct)).thenReturn("<section>label</section>");

        String html = productService.generateLabels(List.of(10L, 11L));

        assertEquals(2, html.split("<section>label</section>", -1).length - 1);
        verify(productLabelService, times(2)).generateLabel(inStockProduct);
        verify(productLabelService, never()).generateLabel(outOfStockProduct);
    }

    @Test
    void shouldRejectBulkLabelsWhenSelectedProductsHaveNoStock() {
        Product outOfStockProduct = product("Blusa Linho", "IWR-000011", 0);

        when(productRepository.findById(11L)).thenReturn(Optional.of(outOfStockProduct));

        assertThrows(BusinessRuleException.class, () -> productService.generateLabels(List.of(11L)));
        verify(productLabelService, never()).generateLabel(any(Product.class));
    }

    private ProductCategory category() {
        ProductCategory category = new ProductCategory();
        category.setId(1L);
        category.setName("Vestidos");
        category.setIcon("dress");
        category.setActive(true);
        return category;
    }

    private Product product(String name, String code, int stockQuantity) {
        Product product = new Product();
        product.setId(Long.valueOf(code.substring(code.length() - 2)));
        product.setName(name);
        product.setCode(code);
        product.setCategory(category());
        product.setPrice(new BigDecimal("149.90"));
        product.setStockQuantity(stockQuantity);
        product.setActive(true);
        return product;
    }
}
