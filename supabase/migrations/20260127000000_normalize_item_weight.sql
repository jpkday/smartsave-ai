-- Add unit and is_weighted to items table
ALTER TABLE items ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'count';
ALTER TABLE items ADD COLUMN IF NOT EXISTS is_weighted BOOLEAN DEFAULT false;

-- Backfill from shopping_list_events (the most recent record for each item)
WITH latest_events AS (
  SELECT DISTINCT ON (item_id) 
    item_id, 
    unit, 
    is_weighted
  FROM shopping_list_events
  WHERE item_id IS NOT NULL
  ORDER BY item_id, checked_at DESC
)
UPDATE items i
SET 
  unit = le.unit,
  is_weighted = le.is_weighted
FROM latest_events le
WHERE i.id = le.item_id;

-- Fallback: Backfill from price_history for items that haven't been in a trip yet
WITH latest_history AS (
  SELECT DISTINCT ON (item_id) 
    item_id, 
    unit, 
    is_weighted
  FROM price_history
  WHERE item_id IS NOT NULL
    AND (unit != 'count' OR is_weighted = true) -- Only take if it has real data
  ORDER BY item_id, recorded_date DESC
)
UPDATE items i
SET 
  unit = lh.unit,
  is_weighted = lh.is_weighted
FROM latest_history lh
WHERE i.id = lh.item_id
  AND (i.unit = 'count' AND i.is_weighted = false); -- Only update if still default
