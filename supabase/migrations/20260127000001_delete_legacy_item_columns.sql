-- Remove legacy columns from items table
-- These are no longer used by the application code.
-- category_id (INT) is used instead of category (TEXT)
-- household_code (TEXT) is used instead of user_id (UUID)

ALTER TABLE items DROP COLUMN IF EXISTS user_id;
ALTER TABLE items DROP COLUMN IF EXISTS category;
