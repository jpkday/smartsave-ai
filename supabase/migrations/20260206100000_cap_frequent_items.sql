-- Cap frequent items to 50 results for performance
CREATE OR REPLACE FUNCTION get_frequent_items(household text)
RETURNS TABLE (
  item_id int,
  item_name text,
  purchase_count bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    item_id,
    MAX(item_name) as item_name,
    COUNT(*) as purchase_count
  FROM shopping_list_events
  WHERE household_code = household
    AND item_id IS NOT NULL
  GROUP BY item_id
  ORDER BY purchase_count DESC
  LIMIT 50;
$$;
