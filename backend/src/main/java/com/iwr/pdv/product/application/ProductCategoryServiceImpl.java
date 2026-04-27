package com.iwr.pdv.product.application;

import com.iwr.pdv.product.api.dto.ProductCategoryResponse;
import com.iwr.pdv.product.domain.ProductCategoryRepository;
import com.iwr.pdv.product.mapper.ProductCategoryMapper;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProductCategoryServiceImpl implements ProductCategoryService {

    private final ProductCategoryRepository categoryRepository;
    private final ProductCategoryMapper categoryMapper;

    public ProductCategoryServiceImpl(
            ProductCategoryRepository categoryRepository,
            ProductCategoryMapper categoryMapper
    ) {
        this.categoryRepository = categoryRepository;
        this.categoryMapper = categoryMapper;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductCategoryResponse> listActive() {
        return categoryRepository.findByActiveTrueOrderByNameAsc()
                .stream()
                .map(categoryMapper::toResponse)
                .toList();
    }
}
