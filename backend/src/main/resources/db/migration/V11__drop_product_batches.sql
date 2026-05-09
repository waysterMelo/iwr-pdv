DROP INDEX IF EXISTS idx_products_batch_id;
ALTER TABLE products DROP COLUMN IF EXISTS batch_id;

DROP INDEX IF EXISTS idx_product_batches_status;
DROP INDEX IF EXISTS idx_product_batches_created_at;
DROP TABLE IF EXISTS product_batches;
