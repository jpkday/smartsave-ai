-- Backfill missing store_id values in price_history
-- Match by store name to get store_id
UPDATE price_history ph
SET store_id = s.id
FROM stores s
WHERE ph.store_id IS NULL
  AND ph.store = s.name;

-- Backfill missing item_id values in price_history
-- Match by item_name to get item_id
UPDATE price_history ph
SET item_id = i.id
FROM items i
WHERE ph.item_id IS NULL
  AND ph.item_name = i.name;

-- Log any records that still have NULL values (orphaned records)
-- These would be records where the store or item no longer exists
DO $$
DECLARE
  null_store_count INTEGER;
  null_item_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_store_count FROM price_history WHERE store_id IS NULL;
  SELECT COUNT(*) INTO null_item_count FROM price_history WHERE item_id IS NULL;

  IF null_store_count > 0 THEN
    RAISE NOTICE 'Warning: % price_history records still have NULL store_id', null_store_count;
  END IF;

  IF null_item_count > 0 THEN
    RAISE NOTICE 'Warning: % price_history records still have NULL item_id', null_item_count;
  END IF;
END $$;
