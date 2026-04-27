CREATE TABLE product_batches (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    status VARCHAR(30) NOT NULL,
    created_by_id BIGINT NOT NULL REFERENCES app_users(id),
    labels_printed_at TIMESTAMP WITH TIME ZONE,
    cataloged_at TIMESTAMP WITH TIME ZONE,
    sent_to_store_at DATE,
    store_shipment_note VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

ALTER TABLE products ADD COLUMN batch_id BIGINT REFERENCES product_batches(id);

CREATE INDEX idx_product_batches_status ON product_batches (status);
CREATE INDEX idx_product_batches_created_at ON product_batches (created_at);
CREATE INDEX idx_products_batch_id ON products (batch_id);
