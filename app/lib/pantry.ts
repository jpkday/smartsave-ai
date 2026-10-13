import type { SupabaseClient } from '@supabase/supabase-js';

// The household's own item names, most recently bought first, so AI suggestions
// reuse names that already exist (and match prices and history) instead of new ones.
export async function getPantryNames(supabase: SupabaseClient, householdCode: string, limit = 400) {
  const { data: events } = await supabase
    .from('shopping_list_events')
    .select('item_name')
    .eq('household_code', householdCode)
    .not('item_name', 'is', null)
    .order('checked_at', { ascending: false })
    .limit(3000);
  return [...new Set((events ?? []).map((e) => e.item_name as string))].slice(0, limit);
}
