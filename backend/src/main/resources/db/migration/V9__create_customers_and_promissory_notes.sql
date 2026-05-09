CREATE TABLE customers (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(140) NOT NULL,
    cpf VARCHAR(20),
    phone VARCHAR(30),
    email VARCHAR(140),
    address VARCHAR(240),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE UNIQUE INDEX uk_customers_cpf ON customers (cpf) WHERE cpf IS NOT NULL;
CREATE UNIQUE INDEX uk_customers_email ON customers (email) WHERE email IS NOT NULL;
CREATE INDEX idx_customers_name ON customers (name);
CREATE INDEX idx_customers_active ON customers (active);

ALTER TABLE sales
    ADD COLUMN customer_id BIGINT REFERENCES customers (id);

CREATE INDEX idx_sales_customer_id ON sales (customer_id);

ALTER TABLE cash_movements
    ADD COLUMN payment_method VARCHAR(30),
    ADD COLUMN reference_type VARCHAR(40),
    ADD COLUMN reference_id BIGINT;

CREATE INDEX idx_cash_movements_reference ON cash_movements (reference_type, reference_id);

CREATE TABLE promissory_notes (
    id BIGSERIAL PRIMARY KEY,
    sale_id BIGINT NOT NULL REFERENCES sales (id),
    customer_id BIGINT NOT NULL REFERENCES customers (id),
    installment_number INTEGER NOT NULL,
    total_installments INTEGER NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(30) NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    paid_by_user_id BIGINT REFERENCES app_users (id),
    payment_method VARCHAR(30),
    cash_register_id BIGINT REFERENCES cash_registers (id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uk_promissory_notes_sale_installment UNIQUE (sale_id, installment_number)
);

CREATE INDEX idx_promissory_notes_customer_id ON promissory_notes (customer_id);
CREATE INDEX idx_promissory_notes_status ON promissory_notes (status);
CREATE INDEX idx_promissory_notes_due_date ON promissory_notes (due_date);
CREATE INDEX idx_promissory_notes_status_due_date ON promissory_notes (status, due_date);
