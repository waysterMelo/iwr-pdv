ALTER TABLE customers
    ADD COLUMN address_street VARCHAR(140),
    ADD COLUMN address_number VARCHAR(30),
    ADD COLUMN address_neighborhood VARCHAR(100),
    ADD COLUMN address_complement VARCHAR(120),
    ADD COLUMN address_city VARCHAR(100),
    ADD COLUMN address_state VARCHAR(2),
    ADD COLUMN address_zip_code VARCHAR(20);

