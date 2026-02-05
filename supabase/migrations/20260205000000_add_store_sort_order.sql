-- Add sort_order column to household_store_favorites for store ranking
-- This allows households to customize the order their favorite stores appear

-- Add the column with a default value
ALTER TABLE household_store_favorites ADD COLUMN IF NOT EXISTS sort_order REAL DEFAULT 0;

-- Create index for efficient ordering queries
CREATE INDEX IF NOT EXISTS idx_hsf_household_sort
ON household_store_favorites(household_code, sort_order);

-- Backfill existing favorites with incremental sort_order values
-- Using gaps of 1000 to allow easy insertions between items later
WITH ranked AS (
  SELECT
    household_code,
    store_id,
    ROW_NUMBER() OVER (
      PARTITION BY household_code
      ORDER BY store_id
    ) * 1000.0 AS new_order
  FROM household_store_favorites
  WHERE sort_order = 0 OR sort_order IS NULL
)
UPDATE household_store_favorites hsf
SET sort_order = ranked.new_order
FROM ranked
WHERE hsf.household_code = ranked.household_code
  AND hsf.store_id = ranked.store_id
  AND (hsf.sort_order = 0 OR hsf.sort_order IS NULL);

-- Make sort_order NOT NULL after backfill
ALTER TABLE household_store_favorites ALTER COLUMN sort_order SET NOT NULL;
