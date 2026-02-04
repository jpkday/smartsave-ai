
-- Add curation flag to track which items have been cleaned by AI
ALTER TABLE items
ADD COLUMN IF NOT EXISTS is_curated boolean DEFAULT false;

-- Allow null usage for now, but backfill existing as false
UPDATE items SET is_curated = false WHERE is_curated IS NULL;
