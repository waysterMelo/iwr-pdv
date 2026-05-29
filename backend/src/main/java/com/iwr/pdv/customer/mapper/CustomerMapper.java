package com.iwr.pdv.customer.mapper;

import com.iwr.pdv.customer.api.dto.CustomerResponse;
import com.iwr.pdv.customer.domain.Customer;
import org.springframework.stereotype.Component;

@Component
public class CustomerMapper {

    public CustomerResponse toResponse(Customer customer) {
        if (customer == null) {
            return null;
        }

        return new CustomerResponse(
                customer.getId(),
                customer.getName(),
                customer.getCpf(),
                customer.getPhone(),
                customer.getEmail(),
                customer.getAddress(),
                customer.getAddressStreet(),
                customer.getAddressNumber(),
                customer.getAddressNeighborhood(),
                customer.getAddressComplement(),
                customer.getAddressCity(),
                customer.getAddressState(),
                customer.getAddressZipCode(),
                customer.getBirthDate(),
                customer.getActive(),
                customer.getCreatedAt(),
                customer.getUpdatedAt(),
                customer.getObservations(),
                customer.getCreditLimit()
        );
    }
}
