package com.iwr.pdv.promissorynote.domain;

import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PromissoryNoteCollectionEventRepository extends JpaRepository<PromissoryNoteCollectionEvent, Long> {

    @EntityGraph(attributePaths = {"createdBy"})
    List<PromissoryNoteCollectionEvent> findByNoteIdOrderByCreatedAtDesc(Long noteId);
}
