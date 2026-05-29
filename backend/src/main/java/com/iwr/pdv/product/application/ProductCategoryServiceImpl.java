package com.iwr.pdv.product.application;

import com.iwr.pdv.common.exception.ResourceConflictException;
import com.iwr.pdv.product.api.dto.ProductCategoryRequest;
import com.iwr.pdv.product.api.dto.ProductCategoryResponse;
import com.iwr.pdv.product.domain.ProductCategory;
import com.iwr.pdv.product.domain.ProductCategoryRepository;
import com.iwr.pdv.product.mapper.ProductCategoryMapper;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProductCategoryServiceImpl implements ProductCategoryService {

    private final ProductCategoryRepository categoryRepository;
    private final ProductCategoryMapper categoryMapper;
    private final Clock clock;

    public ProductCategoryServiceImpl(
            ProductCategoryRepository categoryRepository,
            ProductCategoryMapper categoryMapper,
            Clock clock
    ) {
        this.categoryRepository = categoryRepository;
        this.categoryMapper = categoryMapper;
        this.clock = clock;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductCategoryResponse> listActive() {
        return categoryRepository.findByActiveTrueOrderByNameAsc()
                .stream()
                .map(categoryMapper::toResponse)
                .toList();
    }

    @Override
    @Transactional
    public ProductCategoryResponse create(ProductCategoryRequest request) {
        String name = request.name().trim();
        categoryRepository.findByNameIgnoreCase(name)
                .ifPresent(existing -> {
                    throw new ResourceConflictException("A product category named '" + name + "' already exists.");
                });

        OffsetDateTime now = OffsetDateTime.now(clock);
        ProductCategory category = new ProductCategory();
        category.setName(name);
        category.setIcon(normalizeIcon(request.icon()));
        category.setActive(true);
        category.setCreatedAt(now);
        category.setUpdatedAt(now);

        return categoryMapper.toResponse(categoryRepository.save(category));
    }

    private String normalizeIcon(String icon) {
        if (icon == null || icon.isBlank()) {
            return "tag";
        }

        return icon.trim().toLowerCase();
    }
}
