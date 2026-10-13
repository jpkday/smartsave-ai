-- Meal planning: a shared weekly dinner plan per household, a running ideas list,
-- and the ingredients each household uses for a meal (so "Build list" is instant
-- the second time a meal comes up, and reflects the household's own edits).

CREATE TABLE IF NOT EXISTS meal_plan_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_code TEXT NOT NULL,
  plan_date DATE NOT NULL,
  meal TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One dinner per household per day
  UNIQUE(household_code, plan_date)
);

CREATE INDEX IF NOT EXISTS idx_meal_plan_days_lookup
ON meal_plan_days(household_code, plan_date);

CREATE TABLE IF NOT EXISTS meal_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_code TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meal_ideas_household
ON meal_ideas(household_code, created_at);

CREATE TABLE IF NOT EXISTS meal_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_code TEXT NOT NULL,
  -- Normalized meal name (lowercase, trimmed, single spaces)
  meal_key TEXT NOT NULL,
  item_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meal_ingredients_lookup
ON meal_ingredients(household_code, meal_key, sort_order);

-- RLS: the household code is the credential, as with the other household tables
ALTER TABLE meal_plan_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their household meal plan"
ON meal_plan_days FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Users can manage their household meal ideas"
ON meal_ideas FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Users can manage their household meal ingredients"
ON meal_ingredients FOR ALL USING (true) WITH CHECK (true);
