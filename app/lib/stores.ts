import { supabase } from './supabase';
import { getHouseholdCode } from './householdCode';

/**
 * Narrow a store list to the current household's favorite stores.
 * Falls back to all stores when the household has no favorites yet (legacy behavior).
 */
export async function filterToHouseholdStores<T extends { id: string }>(stores: T[]): Promise<T[]> {
  const householdCode = getHouseholdCode();
  if (!householdCode) return stores;

  const { data: favorites } = await supabase
    .from('household_store_favorites')
    .select('store_id')
    .eq('household_code', householdCode);

  if (!favorites || favorites.length === 0) return stores;
  const favoriteIds = new Set(favorites.map((f) => f.store_id));
  return stores.filter((s) => favoriteIds.has(s.id));
}
