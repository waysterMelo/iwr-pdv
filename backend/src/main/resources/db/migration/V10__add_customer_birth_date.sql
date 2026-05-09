ALTER TABLE customers
    ADD COLUMN birth_date DATE;

CREATE INDEX idx_customers_birth_date ON customers (birth_date);
