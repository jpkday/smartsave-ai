
-- Remove the specific 'unique_store_item' constraint that is blocking multiple SKUs per item
-- This is likely a constraint on (store_id, item_id)

ALTER TABLE store_item_sku
DROP CONSTRAINT IF EXISTS unique_store_item;

-- Re-ensure we have the correct constraint for data integrity
-- We want: One SKU can only belong to One Item.
-- But: One Item can have Multiple SKUs.

ALTER TABLE store_item_sku
DROP CONSTRAINT IF EXISTS store_item_sku_store_id_store_sku_key; -- drop if exists to be safe

ALTER TABLE store_item_sku
ADD CONSTRAINT store_item_sku_store_id_store_sku_key 
UNIQUE (store_id, store_sku);
