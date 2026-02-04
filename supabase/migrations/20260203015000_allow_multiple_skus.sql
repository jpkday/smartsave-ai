
-- Fix store_item_sku constraints to allow multiple SKUs (UPC + WebID) per item per store.

-- 1. Drop the restrictive constraint that limits 1 SKU per Item per Store
ALTER TABLE store_item_sku
DROP CONSTRAINT IF EXISTS store_item_sku_store_id_item_id_key;

-- 2. Ensure that a specific SKU at a specific Store only maps to ONE item (Sanity check)
-- This is likely already enforced or the Primary Key, but let's be explicit.
-- We want to allow:
-- (Walmart, SKU_WEB_123, Item_A)
-- (Walmart, SKU_UPC_456, Item_A)
--
-- We do NOT want:
-- (Walmart, SKU_WEB_123, Item_B) -- Conflicting mapping

ALTER TABLE store_item_sku
ADD CONSTRAINT store_item_sku_store_id_store_sku_key 
UNIQUE (store_id, store_sku);
