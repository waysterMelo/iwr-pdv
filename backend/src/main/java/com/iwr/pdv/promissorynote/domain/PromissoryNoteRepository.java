package com.iwr.pdv.promissorynote.domain;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PromissoryNoteRepository extends JpaRepository<PromissoryNote, Long> {

    @EntityGraph(attributePaths = {"customer", "sale", "sale.items"})
    List<PromissoryNote> findByStatusAndDueDateBetweenOrderByDueDateAsc(PromissoryNoteStatus status, LocalDate startDate, LocalDate endDate);

    @EntityGraph(attributePaths = {"customer", "sale", "sale.items"})
    List<PromissoryNote> findByCustomerIdAndDueDateBetweenOrderByDueDateAsc(Long customerId, LocalDate startDate, LocalDate endDate);

    @EntityGraph(attributePaths = {"customer", "sale", "sale.items"})
    List<PromissoryNote> findByCustomerIdAndStatusAndDueDateBetweenOrderByDueDateAsc(
            Long customerId,
            PromissoryNoteStatus status,
            LocalDate startDate,
            LocalDate endDate
    );

    @EntityGraph(attributePaths = {"customer", "sale", "sale.items"})
    List<PromissoryNote> findByDueDateBetweenOrderByDueDateAsc(LocalDate startDate, LocalDate endDate);

    @EntityGraph(attributePaths = {"customer", "sale", "sale.items"})
    List<PromissoryNote> findBySaleIdOrderByInstallmentNumberAsc(Long saleId);

    @Override
    @EntityGraph(attributePaths = {"customer", "sale", "sale.items", "paidBy", "cashRegister"})
    Optional<PromissoryNote> findById(Long id);
}
