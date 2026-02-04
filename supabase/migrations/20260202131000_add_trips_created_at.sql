-- Add created_at to trips table to track when the record was entered vs when the trip happened
alter table trips
add column if not exists created_at timestamptz default now();

-- Backfill existing records to match started_at (best guess) or keep as now()
-- Using started_at as a proxy for old records seems reasonable
update trips
set created_at = started_at
where created_at is null;

-- Make it non-null after backfill
alter table trips
alter column created_at set not null;
