package com.iwr.pdv.promissorynote.domain;

import com.iwr.pdv.auth.domain.AppUser;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "promissory_note_collection_events")
public class PromissoryNoteCollectionEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "note_id", nullable = false)
    private PromissoryNote note;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private PromissoryNoteCollectionAction action;

    @Column(length = 500)
    private String comment;

    @Column(name = "promised_payment_date")
    private LocalDate promisedPaymentDate;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by_user_id", nullable = false)
    private AppUser createdBy;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public PromissoryNote getNote() {
        return note;
    }

    public void setNote(PromissoryNote note) {
        this.note = note;
    }

    public PromissoryNoteCollectionAction getAction() {
        return action;
    }

    public void setAction(PromissoryNoteCollectionAction action) {
        this.action = action;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public LocalDate getPromisedPaymentDate() {
        return promisedPaymentDate;
    }

    public void setPromisedPaymentDate(LocalDate promisedPaymentDate) {
        this.promisedPaymentDate = promisedPaymentDate;
    }

    public AppUser getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(AppUser createdBy) {
        this.createdBy = createdBy;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
