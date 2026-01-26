-- Drop old function signature if exists (might have different return type)
DROP FUNCTION IF EXISTS get_frequent_items(text);

CREATE OR REPLACE FUNCTION get_frequent_items(household text)
RETURNS TABLE (
  item_id int,
  item_name text,
  purchase_count bigint
) 
LANGUAGE sql
AS $$
  SELECT 
    item_id,
    MAX(item_name) as item_name, -- Just take one name (e.g. latest or random) for display fallback
    COUNT(*) as purchase_count
  FROM shopping_list_events
  WHERE household_code = household
  AND item_id IS NOT NULL -- We only care about items that have an ID now
  GROUP BY item_id
  ORDER BY purchase_count DESC;
$$;
