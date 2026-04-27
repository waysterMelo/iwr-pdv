CREATE TABLE product_categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE,
    icon VARCHAR(40) NOT NULL,
    active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_product_categories_active ON product_categories (active);

INSERT INTO product_categories (name, icon, active, created_at, updated_at)
VALUES
    ('Vestidos', 'dress', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('Blusas', 'shirt', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('Calcas', 'pants', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('Saias', 'skirt', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('Bolsas', 'bag', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('Acessorios', 'sparkles', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('Sem categoria', 'tag', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

ALTER TABLE products ADD COLUMN category_id BIGINT;

UPDATE products
SET category_id = (SELECT id FROM product_categories WHERE name = 'Sem categoria')
WHERE category_id IS NULL;

ALTER TABLE products
    ALTER COLUMN category_id SET NOT NULL,
    ADD CONSTRAINT fk_products_category
        FOREIGN KEY (category_id) REFERENCES product_categories(id);

CREATE INDEX idx_products_category_id ON products (category_id);
