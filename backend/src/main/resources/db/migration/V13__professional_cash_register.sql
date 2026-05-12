ALTER TABLE cash_registers
    ADD COLUMN closing_difference_reason VARCHAR(240),
    ADD COLUMN reopened_by_user_id BIGINT REFERENCES app_users (id),
    ADD COLUMN reopened_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN reopen_reason VARCHAR(240);

CREATE INDEX idx_cash_registers_opened_at ON cash_registers (opened_at);
CREATE INDEX idx_cash_registers_closed_at ON cash_registers (closed_at);
