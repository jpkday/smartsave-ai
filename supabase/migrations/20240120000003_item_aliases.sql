create table if not exists item_aliases (
  id bigint primary key generated always as identity,
  item_id bigint references items(id) on delete cascade not null,
  alias text not null,
  created_at timestamptz default now(),
  unique (alias)
);

-- Basic RLS
alter table item_aliases enable row level security;

create policy "Users can view all aliases"
  on item_aliases for select
  using (true);

create policy "Users can insert aliases"
  on item_aliases for insert
  with check (true);
