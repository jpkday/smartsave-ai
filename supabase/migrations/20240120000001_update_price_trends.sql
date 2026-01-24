-- Clean up ALL possible versions to avoid overloading confusion
DROP FUNCTION IF EXISTS get_price_trends();
DROP FUNCTION IF EXISTS get_price_trends(integer);
DROP FUNCTION IF EXISTS get_price_analysis(integer);

CREATE OR REPLACE FUNCTION get_price_analysis(days_back integer DEFAULT 30)
RETURNS TABLE (
  item_name text,
  store_id uuid,
  store_name text,
  start_price numeric,
  current_price numeric,
  pct_change numeric
) 
LANGUAGE sql
AS $$
  WITH range_prices AS (
    SELECT 
      store_id, 
      store, 
      item_name, 
      price, 
      recorded_date,
      ROW_NUMBER() OVER (PARTITION BY store_id, item_name ORDER BY recorded_date ASC) as rn_asc,
      ROW_NUMBER() OVER (PARTITION BY store_id, item_name ORDER BY recorded_date DESC) as rn_desc
    FROM price_history
    WHERE recorded_date >= (CURRENT_DATE - (days_back || ' days')::interval)
  )
  SELECT 
    FirstP.item_name,
    FirstP.store_id,
    FirstP.store as store_name,
    FirstP.price as start_price,
    LastP.price as current_price,
    ((LastP.price - FirstP.price) / FirstP.price) * 100 as pct_change
  FROM range_prices FirstP
  JOIN range_prices LastP ON 
    FirstP.store_id = LastP.store_id AND 
    FirstP.item_name = LastP.item_name
  WHERE FirstP.rn_asc = 1 AND LastP.rn_desc = 1
  AND FirstP.price IS DISTINCT FROM LastP.price
  ORDER BY ABS(((LastP.price - FirstP.price) / FirstP.price) * 100) DESC;
$$;
