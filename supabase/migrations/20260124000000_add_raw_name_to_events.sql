-- Add advanced tracking columns to track original OCR text and pricing details
ALTER TABLE shopping_list_events ADD COLUMN IF NOT EXISTS raw_name TEXT;
ALTER TABLE shopping_list_events ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'count';
ALTER TABLE shopping_list_events ADD COLUMN IF NOT EXISTS is_weighted BOOLEAN DEFAULT false;

ALTER TABLE price_history ADD COLUMN IF NOT EXISTS raw_name TEXT;
ALTER TABLE price_history ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'count';
ALTER TABLE price_history ADD COLUMN IF NOT EXISTS is_weighted BOOLEAN DEFAULT false;
