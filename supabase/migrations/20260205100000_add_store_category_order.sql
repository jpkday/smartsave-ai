-- Per-store category ordering for households
-- Allows each household to customize category order per store (for store layout)

CREATE TABLE IF NOT EXISTS household_store_category_order (
  id SERIAL PRIMARY KEY,
  household_code TEXT NOT NULL,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  sort_order REAL NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each household+store+category combination is unique
  UNIQUE(household_code, store_id, category_id)
);

-- Index for efficient lookups by household and store
CREATE INDEX IF NOT EXISTS idx_hsco_lookup
ON household_store_category_order(household_code, store_id, sort_order);

-- RLS policy
ALTER TABLE household_store_category_order ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their household store category order"
ON household_store_category_order
FOR ALL
USING (true)
WITH CHECK (true);
