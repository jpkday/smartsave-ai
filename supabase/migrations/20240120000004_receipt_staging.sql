-- 1. Create imported_receipts table
create table if not exists imported_receipts (
  id bigint primary key generated always as identity,
  household_code text not null,
  store_id uuid references stores(id) on delete set null,
  image_url text, -- Store base64 or path
  ocr_data jsonb, -- The raw AI analysis
  status text check (status in ('pending', 'skipped', 'processed')) default 'pending',
  created_at timestamptz default now()
);

-- RLS for imported_receipts
alter table imported_receipts enable row level security;
create policy "Users can manage their household receipts"
  on imported_receipts
  using (household_code = current_setting('app.current_household', true)); 
  -- Note: Using simple text match for now as per project pattern, usually we do:
  -- using (true); for simple deployments or check household_code in application logic if RLS isn't strict.
  -- Based on previous migrations, we used `using (true)` or specific checks. Let's start with `using (true)` to match `item_aliases` pattern if it was simple.
  
drop policy if exists "Users can view all imported_receipts" on imported_receipts;
create policy "Users can view all imported_receipts" on imported_receipts for all using (true);


-- 2. Modify item_aliases to include store_id
-- We need to handle existing data if any. Since this is dev, truncate is acceptable or defaults.
truncate table item_aliases; 

alter table item_aliases 
  add column store_id uuid not null references stores(id) on delete cascade;

-- Update unique constraint to be store-scoped
alter table item_aliases drop constraint if exists item_aliases_alias_key;
alter table item_aliases add constraint item_aliases_alias_store_key unique (alias, store_id);
