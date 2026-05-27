package com.iwr.pdv.promissorynote.domain;

import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PromissoryNotePaymentRepository extends JpaRepository<PromissoryNotePayment, Long> {

    @EntityGraph(attributePaths = {"paidBy", "cashRegister"})
    List<PromissoryNotePayment> findByNoteIdOrderByPaidAtDesc(Long noteId);

    @EntityGraph(attributePaths = {"note", "paidBy", "cashRegister"})
    List<PromissoryNotePayment> findByNoteCustomerIdOrderByPaidAtDesc(Long customerId);
}
