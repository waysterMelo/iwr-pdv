package com.iwr.pdv.customer.domain;

import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CustomerRepository extends JpaRepository<Customer, Long> {

    List<Customer> findTop40ByActiveTrueOrderByNameAsc();

    List<Customer> findTop40ByActiveTrueAndNameContainingIgnoreCaseOrderByNameAsc(String name);

    Page<Customer> findByActiveTrue(Pageable pageable);

    Page<Customer> findByActiveTrueAndNameContainingIgnoreCase(String name, Pageable pageable);

    List<Customer> findByActiveTrueAndBirthDateIsNotNullOrderByNameAsc();

    Optional<Customer> findByCpf(String cpf);

    Optional<Customer> findByEmailIgnoreCase(String email);
}
