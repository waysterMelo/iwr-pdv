package com.iwr.pdv.cash.domain;

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
import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "cash_registers")
public class CashRegister {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private CashRegisterStatus status;

    @Column(name = "opening_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal openingAmount;

    @Column(name = "declared_cash_amount", precision = 12, scale = 2)
    private BigDecimal declaredCashAmount;

    @Column(name = "expected_cash_amount", precision = 12, scale = 2)
    private BigDecimal expectedCashAmount;

    @Column(name = "cash_difference", precision = 12, scale = 2)
    private BigDecimal cashDifference;

    @Column(name = "closing_difference_reason", length = 240)
    private String closingDifferenceReason;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "opened_by_user_id", nullable = false)
    private AppUser openedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "closed_by_user_id")
    private AppUser closedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reopened_by_user_id")
    private AppUser reopenedBy;

    @Column(name = "opened_at", nullable = false)
    private OffsetDateTime openedAt;

    @Column(name = "closed_at")
    private OffsetDateTime closedAt;

    @Column(name = "reopened_at")
    private OffsetDateTime reopenedAt;

    @Column(name = "reopen_reason", length = 240)
    private String reopenReason;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public CashRegisterStatus getStatus() {
        return status;
    }

    public void setStatus(CashRegisterStatus status) {
        this.status = status;
    }

    public BigDecimal getOpeningAmount() {
        return openingAmount;
    }

    public void setOpeningAmount(BigDecimal openingAmount) {
        this.openingAmount = openingAmount;
    }

    public BigDecimal getDeclaredCashAmount() {
        return declaredCashAmount;
    }

    public void setDeclaredCashAmount(BigDecimal declaredCashAmount) {
        this.declaredCashAmount = declaredCashAmount;
    }

    public BigDecimal getExpectedCashAmount() {
        return expectedCashAmount;
    }

    public void setExpectedCashAmount(BigDecimal expectedCashAmount) {
        this.expectedCashAmount = expectedCashAmount;
    }

    public BigDecimal getCashDifference() {
        return cashDifference;
    }

    public void setCashDifference(BigDecimal cashDifference) {
        this.cashDifference = cashDifference;
    }

    public String getClosingDifferenceReason() {
        return closingDifferenceReason;
    }

    public void setClosingDifferenceReason(String closingDifferenceReason) {
        this.closingDifferenceReason = closingDifferenceReason;
    }

    public AppUser getOpenedBy() {
        return openedBy;
    }

    public void setOpenedBy(AppUser openedBy) {
        this.openedBy = openedBy;
    }

    public AppUser getClosedBy() {
        return closedBy;
    }

    public void setClosedBy(AppUser closedBy) {
        this.closedBy = closedBy;
    }

    public AppUser getReopenedBy() {
        return reopenedBy;
    }

    public void setReopenedBy(AppUser reopenedBy) {
        this.reopenedBy = reopenedBy;
    }

    public OffsetDateTime getOpenedAt() {
        return openedAt;
    }

    public void setOpenedAt(OffsetDateTime openedAt) {
        this.openedAt = openedAt;
    }

    public OffsetDateTime getClosedAt() {
        return closedAt;
    }

    public void setClosedAt(OffsetDateTime closedAt) {
        this.closedAt = closedAt;
    }

    public OffsetDateTime getReopenedAt() {
        return reopenedAt;
    }

    public void setReopenedAt(OffsetDateTime reopenedAt) {
        this.reopenedAt = reopenedAt;
    }

    public String getReopenReason() {
        return reopenReason;
    }

    public void setReopenReason(String reopenReason) {
        this.reopenReason = reopenReason;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
