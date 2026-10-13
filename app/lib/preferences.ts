import type { SupabaseClient } from '@supabase/supabase-js';

// Foods the household doesn't eat (households.avoid_foods, e.g. ["pork", "ham"]).
// Returns [] if the column isn't there yet or nothing is set.
export async function getAvoidFoods(supabase: SupabaseClient, householdCode: string): Promise<string[]> {
  const { data, error } = await supabase.from('households').select('avoid_foods').eq('code', householdCode).maybeSingle();
  if (error || !data || !Array.isArray(data.avoid_foods)) return [];
  return data.avoid_foods.map((f: unknown) => String(f).toLowerCase().trim()).filter(Boolean);
}

// True when any avoided food appears as a word in the text ("Pork chops", "Italian sausage")
export function containsAvoided(text: string, avoid: string[]) {
  if (avoid.length === 0) return false;
  const lower = text.toLowerCase();
  return avoid.some((food) => new RegExp(`\\b${food.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`).test(lower));
}

// Line for AI prompts so suggestions and ingredient lists respect the household
export function avoidPromptLine(avoid: string[]) {
  return avoid.length > 0
    ? `This household does not eat: ${avoid.join(', ')}. Never suggest dishes built on these or include them as ingredients (bacon is fine unless listed).`
    : '';
}
