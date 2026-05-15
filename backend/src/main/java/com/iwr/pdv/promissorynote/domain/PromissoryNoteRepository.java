package com.iwr.pdv.promissorynote.domain;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PromissoryNoteRepository extends JpaRepository<PromissoryNote, Long> {

    @Modifying
    @Query("""
            update PromissoryNote note
               set note.status = com.iwr.pdv.promissorynote.domain.PromissoryNoteStatus.OVERDUE,
                   note.updatedAt = :updatedAt
             where note.status = com.iwr.pdv.promissorynote.domain.PromissoryNoteStatus.PENDING
               and note.dueDate < :today
            """)
    int markPendingNotesOverdue(@Param("today") LocalDate today, @Param("updatedAt") java.time.OffsetDateTime updatedAt);

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
    List<PromissoryNote> findByStatusInAndDueDateLessThanEqualOrderByDueDateAsc(List<PromissoryNoteStatus> statuses, LocalDate dueDate);

    @EntityGraph(attributePaths = {"customer", "sale", "sale.items"})
    List<PromissoryNote> findBySaleIdOrderByInstallmentNumberAsc(Long saleId);

    List<PromissoryNote> findByIdIn(List<Long> ids);

    @Override
    @EntityGraph(attributePaths = {"customer", "sale", "sale.items", "paidBy", "cashRegister"})
    Optional<PromissoryNote> findById(Long id);
}
