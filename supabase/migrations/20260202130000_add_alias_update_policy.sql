-- Enable Update and Delete for item_aliases to allow upserts and corrections
-- This matches the existing permissive SELECT/INSERT policies

create policy "Users can update aliases"
  on item_aliases for update
  using (true)
  with check (true);

create policy "Users can delete aliases"
  on item_aliases for delete
  using (true);
