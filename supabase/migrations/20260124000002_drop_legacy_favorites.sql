-- Drop legacy is_favorite column from items table
-- This has been replaced by the household_item_favorites table
ALTER TABLE items DROP COLUMN IF NOT EXISTS is_favorite;
 village
