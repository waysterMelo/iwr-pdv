package com.iwr.pdv.customer.application;

import com.iwr.pdv.common.exception.ResourceConflictException;
import com.iwr.pdv.common.exception.ResourceNotFoundException;
import com.iwr.pdv.customer.api.dto.CustomerPageResponse;
import com.iwr.pdv.customer.api.dto.CustomerRequest;
import com.iwr.pdv.customer.api.dto.CustomerResponse;
import com.iwr.pdv.customer.domain.Customer;
import com.iwr.pdv.customer.domain.CustomerRepository;
import com.iwr.pdv.customer.mapper.CustomerMapper;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CustomerServiceImpl implements CustomerService {

    private final CustomerRepository customerRepository;
    private final CustomerMapper customerMapper;
    private final Clock clock;

    public CustomerServiceImpl(CustomerRepository customerRepository, CustomerMapper customerMapper, Clock clock) {
        this.customerRepository = customerRepository;
        this.customerMapper = customerMapper;
        this.clock = clock;
    }

    @Override
    @Transactional(readOnly = true)
    public List<CustomerResponse> list(String search) {
        String normalizedSearch = normalize(search);
        List<Customer> customers = normalizedSearch == null
                ? customerRepository.findTop40ByActiveTrueOrderByNameAsc()
                : customerRepository.findTop40ByActiveTrueAndNameContainingIgnoreCaseOrderByNameAsc(normalizedSearch);

        return customers.stream().map(customerMapper::toResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public CustomerPageResponse listPage(String search, int page, int size) {
        String normalizedSearch = normalize(search);
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 30);
        PageRequest pageRequest = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.ASC, "name"));

        Page<Customer> customers = normalizedSearch == null
                ? customerRepository.findByActiveTrue(pageRequest)
                : customerRepository.findByActiveTrueAndNameContainingIgnoreCase(normalizedSearch, pageRequest);

        return new CustomerPageResponse(
                customers.getContent().stream().map(customerMapper::toResponse).toList(),
                customers.getNumber(),
                customers.getSize(),
                customers.getTotalElements(),
                customers.getTotalPages(),
                customers.isFirst(),
                customers.isLast()
        );
    }

    @Override
    @Transactional(readOnly = true)
    public List<CustomerResponse> birthdays() {
        return customerRepository.findByActiveTrueAndBirthDateIsNotNullOrderByNameAsc()
                .stream()
                .map(customerMapper::toResponse)
                .toList();
    }

    @Override
    @Transactional
    public CustomerResponse create(CustomerRequest request) {
        validateUniqueFields(request, null);

        OffsetDateTime now = OffsetDateTime.now(clock);
        Customer customer = new Customer();
        customer.setCreatedAt(now);
        customer.setUpdatedAt(now);
        apply(customer, request);

        return customerMapper.toResponse(customerRepository.save(customer));
    }

    @Override
    @Transactional
    public CustomerResponse update(Long customerId, CustomerRequest request) {
        Customer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found for id " + customerId + "."));
        validateUniqueFields(request, customerId);

        apply(customer, request);
        customer.setUpdatedAt(OffsetDateTime.now(clock));

        return customerMapper.toResponse(customer);
    }

    private void apply(Customer customer, CustomerRequest request) {
        customer.setName(request.name().trim());
        customer.setCpf(normalize(request.cpf()));
        customer.setPhone(normalize(request.phone()));
        customer.setEmail(normalize(request.email()));
        customer.setAddress(normalize(request.address()));
        customer.setBirthDate(request.birthDate());
        customer.setActive(request.active() == null || request.active());
    }

    private void validateUniqueFields(CustomerRequest request, Long currentCustomerId) {
        String cpf = normalize(request.cpf());
        if (cpf != null) {
            customerRepository.findByCpf(cpf)
                    .filter(customer -> !customer.getId().equals(currentCustomerId))
                    .ifPresent(customer -> {
                        throw new ResourceConflictException("There is already a customer with this CPF.");
                    });
        }

        String email = normalize(request.email());
        if (email != null) {
            customerRepository.findByEmailIgnoreCase(email)
                    .filter(customer -> !customer.getId().equals(currentCustomerId))
                    .ifPresent(customer -> {
                        throw new ResourceConflictException("There is already a customer with this email.");
                    });
        }
    }

    private String normalize(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        return value.trim();
    }
}
