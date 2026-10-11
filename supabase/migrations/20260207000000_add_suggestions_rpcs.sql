-- ============================================
-- Suggestions RPCs for shopping list carousel
-- Scoped to favorite stores only
-- ============================================

-- 1. Items clearly overdue (days_overdue > 7), with prices at favorite stores
CREATE OR REPLACE FUNCTION get_overdue_items(household text)
RETURNS TABLE (
  item_id int,
  item_name text,
  category_id int,
  times_purchased bigint,
  avg_days_between numeric,
  last_purchase date,
  days_since_last int,
  days_overdue int
)
LANGUAGE sql
STABLE
AS $$
  WITH fav_stores AS (
    SELECT store_id FROM household_store_favorites WHERE household_code = household
  ),
  fav_store_items AS (
    SELECT DISTINCT item_id FROM price_history
    WHERE store_id IN (SELECT store_id FROM fav_stores) AND item_id IS NOT NULL
  ),
  purchase_dates AS (
    SELECT
      e.item_id,
      MAX(e.item_name) as item_name,
      e.checked_at::date as purchase_date
    FROM shopping_list_events e
    WHERE e.household_code = household
      AND e.item_id IS NOT NULL
      AND e.checked_at IS NOT NULL
    GROUP BY e.item_id, e.checked_at::date
  ),
  intervals AS (
    SELECT
      pd.item_id,
      MAX(pd.item_name) as item_name,
      COUNT(*) as times_purchased,
      MAX(pd.purchase_date) as last_purchase,
      ROUND(
        ((MAX(pd.purchase_date) - MIN(pd.purchase_date))::float / NULLIF(COUNT(*) - 1, 0))::numeric,
        1
      ) as avg_days_between
    FROM purchase_dates pd
    GROUP BY pd.item_id
    HAVING COUNT(*) >= 3
  )
  SELECT
    i.item_id,
    i.item_name,
    it.category_id,
    i.times_purchased,
    i.avg_days_between,
    i.last_purchase,
    (CURRENT_DATE - i.last_purchase)::int as days_since_last,
    ((CURRENT_DATE - i.last_purchase) - i.avg_days_between::int)::int as days_overdue
  FROM intervals i
  LEFT JOIN items it ON it.id = i.item_id
  WHERE (CURRENT_DATE - i.last_purchase) - i.avg_days_between::int > 7
    AND i.item_id IN (SELECT item_id FROM fav_store_items)
  ORDER BY days_overdue DESC
  LIMIT 20;
$$;

-- 2. Items approaching their purchase cycle (days_overdue between -3 and 7)
CREATE OR REPLACE FUNCTION get_upcoming_items(household text)
RETURNS TABLE (
  item_id int,
  item_name text,
  category_id int,
  times_purchased bigint,
  avg_days_between numeric,
  last_purchase date,
  days_since_last int,
  days_overdue int
)
LANGUAGE sql
STABLE
AS $$
  WITH fav_stores AS (
    SELECT store_id FROM household_store_favorites WHERE household_code = household
  ),
  fav_store_items AS (
    SELECT DISTINCT item_id FROM price_history
    WHERE store_id IN (SELECT store_id FROM fav_stores) AND item_id IS NOT NULL
  ),
  purchase_dates AS (
    SELECT
      e.item_id,
      MAX(e.item_name) as item_name,
      e.checked_at::date as purchase_date
    FROM shopping_list_events e
    WHERE e.household_code = household
      AND e.item_id IS NOT NULL
      AND e.checked_at IS NOT NULL
    GROUP BY e.item_id, e.checked_at::date
  ),
  intervals AS (
    SELECT
      pd.item_id,
      MAX(pd.item_name) as item_name,
      COUNT(*) as times_purchased,
      MAX(pd.purchase_date) as last_purchase,
      ROUND(
        ((MAX(pd.purchase_date) - MIN(pd.purchase_date))::float / NULLIF(COUNT(*) - 1, 0))::numeric,
        1
      ) as avg_days_between
    FROM purchase_dates pd
    GROUP BY pd.item_id
    HAVING COUNT(*) >= 3
  )
  SELECT
    i.item_id,
    i.item_name,
    it.category_id,
    i.times_purchased,
    i.avg_days_between,
    i.last_purchase,
    (CURRENT_DATE - i.last_purchase)::int as days_since_last,
    ((CURRENT_DATE - i.last_purchase) - i.avg_days_between::int)::int as days_overdue
  FROM intervals i
  LEFT JOIN items it ON it.id = i.item_id
  WHERE ((CURRENT_DATE - i.last_purchase) - i.avg_days_between::int) BETWEEN -3 AND 7
    AND i.item_id IN (SELECT item_id FROM fav_store_items)
  ORDER BY days_overdue DESC
  LIMIT 20;
$$;

-- 3. Per-item co-purchase analysis using lift
-- For each list item, find what's disproportionately bought with it, then pick the best
DROP FUNCTION IF EXISTS get_often_together_items(text, int[]);
CREATE OR REPLACE FUNCTION get_often_together_items(household text, current_item_ids int[])
RETURNS TABLE (
  item_id int,
  item_name text,
  category_id int,
  co_purchase_count bigint,
  lift numeric,
  paired_with_name text
)
LANGUAGE sql
STABLE
AS $$
  WITH fav_stores AS (
    SELECT store_id FROM household_store_favorites WHERE household_code = household
  ),
  fav_store_items AS (
    SELECT DISTINCT item_id FROM price_history
    WHERE store_id IN (SELECT store_id FROM fav_stores) AND item_id IS NOT NULL
  ),
  -- Count shopping sessions
  total_sessions AS (
    SELECT COUNT(DISTINCT e.checked_at::date) as cnt
    FROM shopping_list_events e
    WHERE e.household_code = household
      AND e.checked_at IS NOT NULL
  ),
  -- Base rate: how often each candidate item appears across ALL sessions
  item_base_rate AS (
    SELECT
      e.item_id,
      COUNT(DISTINCT e.checked_at::date) as item_trip_count
    FROM shopping_list_events e
    WHERE e.household_code = household
      AND e.item_id IS NOT NULL
      AND e.checked_at IS NOT NULL
      AND e.item_id != ALL(current_item_ids)
    GROUP BY e.item_id
  ),
  -- Per list item: dates where that specific item was purchased
  per_item_trips AS (
    SELECT
      e.item_id as list_item_id,
      MAX(e.item_name) as list_item_name,
      e.checked_at::date as trip_date
    FROM shopping_list_events e
    WHERE e.household_code = household
      AND e.item_id = ANY(current_item_ids)
      AND e.checked_at IS NOT NULL
    GROUP BY e.item_id, e.checked_at::date
  ),
  per_item_trip_counts AS (
    SELECT list_item_id, MAX(list_item_name) as list_item_name, COUNT(*) as trip_count
    FROM per_item_trips
    GROUP BY list_item_id
    HAVING COUNT(*) >= 3
  ),
  -- Per list item: co-purchases within ±1 day window (multi-store sessions)
  per_item_copurchase AS (
    SELECT
      pit.list_item_id,
      e.item_id as candidate_id,
      MAX(e.item_name) as candidate_name,
      COUNT(DISTINCT e.checked_at::date) as co_count
    FROM shopping_list_events e
    INNER JOIN per_item_trips pit
      ON e.checked_at::date BETWEEN pit.trip_date - 1 AND pit.trip_date + 1
    WHERE e.household_code = household
      AND e.item_id IS NOT NULL
      AND e.checked_at IS NOT NULL
      AND e.item_id != ALL(current_item_ids)
    GROUP BY pit.list_item_id, e.item_id
    HAVING COUNT(DISTINCT e.checked_at::date) >= 3
  ),
  -- Compute per-pair lift
  pair_lift AS (
    SELECT
      pic.candidate_id,
      pic.candidate_name,
      pic.list_item_id,
      pitc.list_item_name,
      pic.co_count,
      pitc.trip_count as list_item_trips,
      ROUND(
        ((pic.co_count::numeric / pitc.trip_count) /
        NULLIF(ibr.item_trip_count::numeric / tt.cnt, 0))
      , 1) as lift
    FROM per_item_copurchase pic
    INNER JOIN per_item_trip_counts pitc ON pitc.list_item_id = pic.list_item_id
    INNER JOIN item_base_rate ibr ON ibr.item_id = pic.candidate_id
    CROSS JOIN total_sessions tt
  ),
  -- Pick best pairing per candidate (highest lift)
  best_pair AS (
    SELECT DISTINCT ON (candidate_id)
      candidate_id,
      candidate_name,
      list_item_name,
      co_count,
      lift
    FROM pair_lift
    WHERE lift > 1.5
    ORDER BY candidate_id, lift DESC, co_count DESC
  )
  SELECT
    bp.candidate_id as item_id,
    bp.candidate_name as item_name,
    it.category_id,
    bp.co_count as co_purchase_count,
    bp.lift,
    bp.list_item_name as paired_with_name
  FROM best_pair bp
  LEFT JOIN items it ON it.id = bp.candidate_id
  WHERE bp.candidate_id IN (SELECT item_id FROM fav_store_items)
  ORDER BY bp.lift DESC, bp.co_count DESC
  LIMIT 15;
$$;

-- 4. Price drops on items user has bought before (at favorite stores only)
CREATE OR REPLACE FUNCTION get_pantry_deals(household text)
RETURNS TABLE (
  item_id int,
  item_name text,
  category_id int,
  store_id uuid,
  store_name text,
  current_price numeric,
  avg_price_paid numeric,
  savings_pct numeric
)
LANGUAGE sql
STABLE
AS $$
  WITH fav_stores AS (
    SELECT store_id FROM household_store_favorites WHERE household_code = household
  ),
  user_items AS (
    SELECT DISTINCT e.item_id
    FROM shopping_list_events e
    WHERE e.household_code = household
      AND e.item_id IS NOT NULL
      AND e.checked_at IS NOT NULL
  ),
  user_avg_prices AS (
    SELECT
      ph.item_id,
      ROUND(AVG(ph.price)::numeric, 2) as avg_price
    FROM price_history ph
    INNER JOIN user_items ui ON ui.item_id = ph.item_id
    WHERE ph.item_id IS NOT NULL
      AND ph.store_id IN (SELECT store_id FROM fav_stores)
    GROUP BY ph.item_id
    HAVING COUNT(*) >= 2
  ),
  recent_prices AS (
    SELECT DISTINCT ON (ph.item_id, ph.store_id)
      ph.item_id,
      ph.item_name,
      ph.store_id,
      ph.store as store_name,
      ph.price
    FROM price_history ph
    INNER JOIN user_items ui ON ui.item_id = ph.item_id
    WHERE ph.recorded_date >= CURRENT_DATE - 14
      AND ph.item_id IS NOT NULL
      AND ph.store_id IN (SELECT store_id FROM fav_stores)
    ORDER BY ph.item_id, ph.store_id, ph.recorded_date DESC
  )
  SELECT
    rp.item_id,
    rp.item_name,
    it.category_id,
    rp.store_id,
    rp.store_name,
    ROUND(rp.price::numeric, 2) as current_price,
    uap.avg_price as avg_price_paid,
    ROUND(((uap.avg_price - rp.price) / uap.avg_price * 100)::numeric, 0) as savings_pct
  FROM recent_prices rp
  INNER JOIN user_avg_prices uap ON uap.item_id = rp.item_id
  LEFT JOIN items it ON it.id = rp.item_id
  WHERE rp.price < uap.avg_price * 0.85
  ORDER BY savings_pct DESC
  LIMIT 15;
$$;
