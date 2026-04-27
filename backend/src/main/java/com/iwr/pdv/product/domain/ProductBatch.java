package com.iwr.pdv.product.domain;

import com.iwr.pdv.auth.domain.AppUser;
import jakarta.persistence.CascadeType;
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
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "product_batches")
public class ProductBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ProductBatchStatus status;

    @ManyToOne(optional = false)
    @JoinColumn(name = "created_by_id", nullable = false)
    private AppUser createdBy;

    @OneToMany(mappedBy = "batch", cascade = CascadeType.ALL, orphanRemoval = false, fetch = FetchType.LAZY)
    private List<Product> products = new ArrayList<>();

    @Column(name = "labels_printed_at")
    private OffsetDateTime labelsPrintedAt;

    @Column(name = "cataloged_at")
    private OffsetDateTime catalogedAt;

    @Column(name = "sent_to_store_at")
    private LocalDate sentToStoreAt;

    @Column(name = "store_shipment_note", length = 255)
    private String storeShipmentNote;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public void addProduct(Product product) {
        products.add(product);
        product.setBatch(this);
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public ProductBatchStatus getStatus() {
        return status;
    }

    public void setStatus(ProductBatchStatus status) {
        this.status = status;
    }

    public AppUser getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(AppUser createdBy) {
        this.createdBy = createdBy;
    }

    public List<Product> getProducts() {
        return products;
    }

    public void setProducts(List<Product> products) {
        this.products = products;
    }

    public OffsetDateTime getLabelsPrintedAt() {
        return labelsPrintedAt;
    }

    public void setLabelsPrintedAt(OffsetDateTime labelsPrintedAt) {
        this.labelsPrintedAt = labelsPrintedAt;
    }

    public OffsetDateTime getCatalogedAt() {
        return catalogedAt;
    }

    public void setCatalogedAt(OffsetDateTime catalogedAt) {
        this.catalogedAt = catalogedAt;
    }

    public LocalDate getSentToStoreAt() {
        return sentToStoreAt;
    }

    public void setSentToStoreAt(LocalDate sentToStoreAt) {
        this.sentToStoreAt = sentToStoreAt;
    }

    public String getStoreShipmentNote() {
        return storeShipmentNote;
    }

    public void setStoreShipmentNote(String storeShipmentNote) {
        this.storeShipmentNote = storeShipmentNote;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(OffsetDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
