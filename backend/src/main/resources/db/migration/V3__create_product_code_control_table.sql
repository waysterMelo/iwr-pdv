CREATE TABLE product_code_control (
    id BIGINT PRIMARY KEY,
    next_value BIGINT NOT NULL
);

INSERT INTO product_code_control (id, next_value)
VALUES (1, 1);
