-- Dinners a household has told the app to forget (normalized meal names). Meal
-- suggestions skip these, whether they came from favorites, history, built-in
-- recipes or the AI.
ALTER TABLE households ADD COLUMN IF NOT EXISTS dismissed_meals TEXT[] NOT NULL DEFAULT '{}';
