import type { SupabaseClient } from '@supabase/supabase-js';

// The household's own item names (what's on the list now, then most recently bought),
// so AI suggestions reuse names that already exist instead of creating near-duplicates.
export async function getPantryNames(supabase: SupabaseClient, householdCode: string, limit = 400) {
  const [{ data: listRows }, { data: events }] = await Promise.all([
    supabase.from('shopping_list').select('item_name').eq('household_code', householdCode),
    supabase
      .from('shopping_list_events')
      .select('item_name')
      .eq('household_code', householdCode)
      .not('item_name', 'is', null)
      .order('checked_at', { ascending: false })
      .limit(3000),
  ]);
  const names = [...(listRows ?? []), ...(events ?? [])].map((r) => r.item_name as string).filter(Boolean);
  return [...new Set(names)].slice(0, limit);
}
