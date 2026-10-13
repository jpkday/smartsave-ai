-- What a household has said it has at home ("have") or needs ("need") for an item,
-- overriding the guess from recent purchases. "have" lasts 30 days; "need" lasts
-- until the item is bought again.
CREATE TABLE IF NOT EXISTS household_on_hand (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_code TEXT NOT NULL,
  item_key TEXT NOT NULL,        -- lowercase item name
  item_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('have', 'need')),
  marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(household_code, item_key)
);

CREATE INDEX IF NOT EXISTS idx_household_on_hand_lookup
ON household_on_hand(household_code, marked_at);

-- RLS: the household code is the credential, as with the other household tables
ALTER TABLE household_on_hand ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their household on-hand items"
ON household_on_hand FOR ALL USING (true) WITH CHECK (true);
