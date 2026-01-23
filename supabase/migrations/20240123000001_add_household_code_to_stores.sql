-- Add household_code to stores table
ALTER TABLE stores ADD COLUMN IF NOT EXISTS household_code TEXT;

-- Update existing stores to have the fallback household code 'ASDF'
UPDATE stores SET household_code = 'ASDF' WHERE household_code IS NULL;

-- Now make it NOT NULL
ALTER TABLE stores ALTER COLUMN household_code SET NOT NULL;

-- Create an index for performance
CREATE INDEX IF NOT EXISTS idx_stores_household_code ON stores(household_code);
