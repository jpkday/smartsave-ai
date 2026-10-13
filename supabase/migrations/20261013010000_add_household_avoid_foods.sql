-- Foods a household doesn't eat (e.g. pork). Meal suggestions and AI ingredient
-- lists leave these out. Words are matched against meal and ingredient names.
ALTER TABLE households ADD COLUMN IF NOT EXISTS avoid_foods TEXT[] NOT NULL DEFAULT '{}';
