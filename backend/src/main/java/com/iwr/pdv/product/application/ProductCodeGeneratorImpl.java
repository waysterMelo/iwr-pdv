package com.iwr.pdv.product.application;

import com.iwr.pdv.product.domain.ProductCodeControl;
import com.iwr.pdv.product.domain.ProductCodeControlRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProductCodeGeneratorImpl implements ProductCodeGenerator {

    private final ProductCodeControlRepository productCodeControlRepository;

    public ProductCodeGeneratorImpl(ProductCodeControlRepository productCodeControlRepository) {
        this.productCodeControlRepository = productCodeControlRepository;
    }

    @Override
    @Transactional
    public String generateNextCode() {
        ProductCodeControl control = productCodeControlRepository.lockControlRow()
                .orElseThrow(() -> new IllegalStateException("Product code control row was not found."));

        long sequenceValue = control.getNextValue();
        control.setNextValue(sequenceValue + 1);
        productCodeControlRepository.save(control);

        return "IWR-%06d".formatted(sequenceValue);
    }
}
