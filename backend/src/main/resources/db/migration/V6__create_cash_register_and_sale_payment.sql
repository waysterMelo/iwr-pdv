CREATE TABLE cash_registers (
    id BIGSERIAL PRIMARY KEY,
    status VARCHAR(30) NOT NULL,
    opening_amount NUMERIC(12, 2) NOT NULL,
    declared_cash_amount NUMERIC(12, 2),
    expected_cash_amount NUMERIC(12, 2),
    cash_difference NUMERIC(12, 2),
    opened_by_user_id BIGINT NOT NULL REFERENCES app_users (id),
    closed_by_user_id BIGINT REFERENCES app_users (id),
    opened_at TIMESTAMP WITH TIME ZONE NOT NULL,
    closed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_cash_registers_status ON cash_registers (status);

CREATE TABLE cash_movements (
    id BIGSERIAL PRIMARY KEY,
    cash_register_id BIGINT NOT NULL REFERENCES cash_registers (id),
    movement_type VARCHAR(30) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    reason VARCHAR(180) NOT NULL,
    operator_user_id BIGINT NOT NULL REFERENCES app_users (id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_cash_movements_cash_register_id ON cash_movements (cash_register_id);

ALTER TABLE sales
    ADD COLUMN subtotal_amount NUMERIC(12, 2),
    ADD COLUMN discount_amount NUMERIC(12, 2),
    ADD COLUMN amount_received NUMERIC(12, 2),
    ADD COLUMN change_amount NUMERIC(12, 2),
    ADD COLUMN payment_method VARCHAR(30),
    ADD COLUMN status VARCHAR(30),
    ADD COLUMN operator_user_id BIGINT REFERENCES app_users (id),
    ADD COLUMN cash_register_id BIGINT REFERENCES cash_registers (id),
    ADD COLUMN cancelled_by_user_id BIGINT REFERENCES app_users (id),
    ADD COLUMN cancellation_reason VARCHAR(240),
    ADD COLUMN cancelled_at TIMESTAMP WITH TIME ZONE;

UPDATE sales
SET subtotal_amount = total_amount,
    discount_amount = 0,
    change_amount = 0,
    payment_method = 'CASH',
    status = 'COMPLETED';

ALTER TABLE sales
    ALTER COLUMN subtotal_amount SET NOT NULL,
    ALTER COLUMN discount_amount SET NOT NULL,
    ALTER COLUMN change_amount SET NOT NULL,
    ALTER COLUMN payment_method SET NOT NULL,
    ALTER COLUMN status SET NOT NULL;

CREATE INDEX idx_sales_cash_register_id ON sales (cash_register_id);
CREATE INDEX idx_sales_status ON sales (status);
