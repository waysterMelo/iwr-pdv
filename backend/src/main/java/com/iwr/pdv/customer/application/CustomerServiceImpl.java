package com.iwr.pdv.customer.application;

import com.iwr.pdv.common.exception.ResourceConflictException;
import com.iwr.pdv.common.exception.ResourceNotFoundException;
import com.iwr.pdv.customer.api.dto.CustomerPageResponse;
import com.iwr.pdv.customer.api.dto.CustomerProfileResponse;
import com.iwr.pdv.customer.api.dto.CustomerPurchasedItemResponse;
import com.iwr.pdv.customer.api.dto.CustomerRequest;
import com.iwr.pdv.customer.api.dto.CustomerResponse;
import com.iwr.pdv.customer.domain.Customer;
import com.iwr.pdv.customer.domain.CustomerRepository;
import com.iwr.pdv.customer.mapper.CustomerMapper;
import com.iwr.pdv.promissorynote.domain.PromissoryNote;
import com.iwr.pdv.promissorynote.domain.PromissoryNoteRepository;
import com.iwr.pdv.promissorynote.domain.PromissoryNoteStatus;
import com.iwr.pdv.promissorynote.mapper.PromissoryNoteMapper;
import com.iwr.pdv.sale.domain.Sale;
import com.iwr.pdv.sale.domain.SaleItem;
import com.iwr.pdv.sale.domain.SaleRepository;
import com.iwr.pdv.sale.domain.SaleStatus;
import com.iwr.pdv.sale.mapper.SaleMapper;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CustomerServiceImpl implements CustomerService {

    private final CustomerRepository customerRepository;
    private final CustomerMapper customerMapper;
    private final SaleRepository saleRepository;
    private final SaleMapper saleMapper;
    private final PromissoryNoteRepository promissoryNoteRepository;
    private final PromissoryNoteMapper promissoryNoteMapper;
    private final Clock clock;

    public CustomerServiceImpl(
            CustomerRepository customerRepository,
            CustomerMapper customerMapper,
            SaleRepository saleRepository,
            SaleMapper saleMapper,
            PromissoryNoteRepository promissoryNoteRepository,
            PromissoryNoteMapper promissoryNoteMapper,
            Clock clock
    ) {
        this.customerRepository = customerRepository;
        this.customerMapper = customerMapper;
        this.saleRepository = saleRepository;
        this.saleMapper = saleMapper;
        this.promissoryNoteRepository = promissoryNoteRepository;
        this.promissoryNoteMapper = promissoryNoteMapper;
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
    @Transactional(readOnly = true)
    public CustomerProfileResponse profile(Long customerId) {
        Customer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found for id " + customerId + "."));
        List<Sale> sales = saleRepository.findByCustomerIdOrderBySoldAtDesc(customerId);
        List<PromissoryNote> notes = promissoryNoteRepository.findByCustomerIdOrderByDueDateDesc(customerId);
        List<Sale> completedSales = sales.stream()
                .filter(sale -> sale.getStatus() != SaleStatus.CANCELLED)
                .toList();
        Map<Long, PurchasedItemAccumulator> purchasedItems = new LinkedHashMap<>();

        for (Sale sale : completedSales) {
            for (SaleItem item : sale.getItems()) {
                purchasedItems.computeIfAbsent(
                                item.getProduct().getId(),
                                productId -> new PurchasedItemAccumulator(
                                        item.getProduct().getId(),
                                        item.getProductName(),
                                        item.getProductCode()
                                )
                        )
                        .add(item, sale.getSoldAt());
            }
        }

        BigDecimal totalPurchasedAmount = completedSales.stream()
                .map(Sale::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal openPromissoryAmount = notes.stream()
                .filter(this::isOpenNote)
                .map(this::remainingAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal overduePromissoryAmount = notes.stream()
                .filter(note -> note.getStatus() == PromissoryNoteStatus.OVERDUE)
                .map(this::remainingAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal paidPromissoryAmount = notes.stream()
                .map(note -> note.getPaidAmount() == null ? BigDecimal.ZERO : note.getPaidAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new CustomerProfileResponse(
                customerMapper.toResponse(customer),
                completedSales.size(),
                totalPurchasedAmount,
                notes.stream().filter(this::isOpenNote).count(),
                notes.stream().filter(note -> note.getStatus() == PromissoryNoteStatus.OVERDUE).count(),
                openPromissoryAmount,
                overduePromissoryAmount,
                paidPromissoryAmount,
                purchasedItems.values()
                        .stream()
                        .map(PurchasedItemAccumulator::toResponse)
                        .toList(),
                sales.stream().limit(12).map(saleMapper::toResponse).toList(),
                notes.stream().map(promissoryNoteMapper::toResponse).toList()
        );
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

    private boolean isOpenNote(PromissoryNote note) {
        return note.getStatus() == PromissoryNoteStatus.PENDING
                || note.getStatus() == PromissoryNoteStatus.PARTIALLY_PAID
                || note.getStatus() == PromissoryNoteStatus.OVERDUE;
    }

    private BigDecimal remainingAmount(PromissoryNote note) {
        BigDecimal paidAmount = note.getPaidAmount() == null ? BigDecimal.ZERO : note.getPaidAmount();
        BigDecimal remaining = note.getAmount().subtract(paidAmount);
        return remaining.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : remaining;
    }

    private static class PurchasedItemAccumulator {
        private final Long productId;
        private final String productName;
        private final String productCode;
        private int quantity;
        private BigDecimal totalAmount = BigDecimal.ZERO;
        private OffsetDateTime lastPurchaseAt;

        PurchasedItemAccumulator(Long productId, String productName, String productCode) {
            this.productId = productId;
            this.productName = productName;
            this.productCode = productCode;
        }

        void add(SaleItem item, OffsetDateTime soldAt) {
            quantity += item.getQuantity();
            totalAmount = totalAmount.add(item.getSubtotal());
            if (lastPurchaseAt == null || soldAt.isAfter(lastPurchaseAt)) {
                lastPurchaseAt = soldAt;
            }
        }

        CustomerPurchasedItemResponse toResponse() {
            return new CustomerPurchasedItemResponse(
                    productId,
                    productName,
                    productCode,
                    quantity,
                    totalAmount,
                    lastPurchaseAt
            );
        }
    }
}
