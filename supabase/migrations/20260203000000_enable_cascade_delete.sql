
-- Enable ON DELETE CASCADE for item dependencies
-- This allows deleting an item from the UI to automatically clean up its SKUs and Aliases.

-- 1. Update store_item_sku
ALTER TABLE store_item_sku
DROP CONSTRAINT IF EXISTS store_item_sku_item_id_fkey;

ALTER TABLE store_item_sku
ADD CONSTRAINT store_item_sku_item_id_fkey
FOREIGN KEY (item_id)
REFERENCES items(id)
ON DELETE CASCADE;

-- 2. Update item_aliases
ALTER TABLE item_aliases
DROP CONSTRAINT IF EXISTS item_aliases_item_id_fkey;

ALTER TABLE item_aliases
ADD CONSTRAINT item_aliases_item_id_fkey
FOREIGN KEY (item_id)
REFERENCES items(id)
ON DELETE CASCADE;
