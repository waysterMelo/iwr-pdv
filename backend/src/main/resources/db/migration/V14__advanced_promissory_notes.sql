ALTER TABLE promissory_notes
    ADD COLUMN paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN renegotiated_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN renegotiated_by_user_id BIGINT REFERENCES app_users (id),
    ADD COLUMN renegotiation_reason VARCHAR(240);

CREATE TABLE promissory_note_payments (
    id BIGSERIAL PRIMARY KEY,
    note_id BIGINT NOT NULL REFERENCES promissory_notes (id),
    amount NUMERIC(12, 2) NOT NULL,
    penalty_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    interest_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_received NUMERIC(12, 2) NOT NULL,
    payment_method VARCHAR(30) NOT NULL,
    paid_by_user_id BIGINT NOT NULL REFERENCES app_users (id),
    cash_register_id BIGINT NOT NULL REFERENCES cash_registers (id),
    paid_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_promissory_note_payments_note_id ON promissory_note_payments (note_id);
CREATE INDEX idx_promissory_note_payments_paid_at ON promissory_note_payments (paid_at);

CREATE TABLE promissory_note_collection_events (
    id BIGSERIAL PRIMARY KEY,
    note_id BIGINT NOT NULL REFERENCES promissory_notes (id),
    action VARCHAR(40) NOT NULL,
    comment VARCHAR(500),
    promised_payment_date DATE,
    created_by_user_id BIGINT NOT NULL REFERENCES app_users (id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_promissory_note_collection_events_note_id ON promissory_note_collection_events (note_id);
CREATE INDEX idx_promissory_note_collection_events_created_at ON promissory_note_collection_events (created_at);
