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

// How far back a checked-off purchase counts as "probably still have it"
export const RECENT_PURCHASE_DAYS = 14;

// Items the household checked off on a trip recently, keyed by lowercase name,
// with the most recent purchase date. Used as a stand-in for "what's at home".
export async function getRecentPurchases(supabase: SupabaseClient, householdCode: string, days = RECENT_PURCHASE_DAYS) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data: events } = await supabase
    .from('shopping_list_events')
    .select('item_name, checked_at')
    .eq('household_code', householdCode)
    .not('item_name', 'is', null)
    .gte('checked_at', since)
    .order('checked_at', { ascending: false });
  const recent = new Map<string, { name: string; date: string }>();
  (events ?? []).forEach((e) => {
    const key = (e.item_name as string).toLowerCase();
    if (!recent.has(key)) recent.set(key, { name: e.item_name as string, date: (e.checked_at as string).slice(0, 10) });
  });
  return recent;
}

// Maps an AI-written grocery name onto the household's exact item name when they
// differ only by a size/count note or punctuation ("Chicken Thighs, Organic" →
// "Chicken Thighs, Organic (lb)"). Names with no match are returned unchanged.
const looseName = (name: string) =>
  name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim();

export function nameResolver(householdNames: string[]) {
  const byLoose = new Map<string, string>();
  householdNames.forEach((name) => {
    const key = looseName(name);
    if (key && !byLoose.has(key)) byLoose.set(key, name);
  });
  return (name: string) => byLoose.get(looseName(name)) ?? name;
}
