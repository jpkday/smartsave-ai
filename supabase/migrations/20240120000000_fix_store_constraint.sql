-- Drop the existing unique constraint on 'name'
ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_name_key;

-- Create a new unique index on name and location
-- We use COALESCE(location, '') to treat NULL locations as empty strings for uniqueness purposes
-- This ensures we can't have multiple 'Walmart' entries with no location
CREATE UNIQUE INDEX IF NOT EXISTS stores_name_location_idx 
ON stores (name, COALESCE(location, ''));
