import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { generateJson } from '../../../lib/gemini';
import { mealKey, MealSuggestion, SuggestionIngredient } from '../../../lib/meals';
import { getPantryNames, getRecentPurchases, nameResolver, RECENT_PURCHASE_DAYS } from '../../../lib/pantry';

// Suggests dinners for the week from what the household bought recently (to use it
// up), meals they've planned before, and their ideas list. Each ingredient is marked
// as probably at home (bought recently), already on the list, or still to buy.

const SUGGESTION_COUNT = 6;
const PAST_MEALS_DAYS = 120;

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseServiceKey) return null;
  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    if (!supabase) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });

    const body = await request.json();
    const householdCode = String(body.household_code || '').toUpperCase();
    const exclude: string[] = Array.isArray(body.exclude)
      ? body.exclude.map((m: unknown) => String(m || '').trim().slice(0, 120)).filter(Boolean).slice(0, 14)
      : [];
    if (!householdCode) return NextResponse.json({ error: 'household_code is required' }, { status: 400 });

    const { data: household } = await supabase.from('households').select('code').eq('code', householdCode).maybeSingle();
    if (!household) return NextResponse.json({ error: 'Unknown household' }, { status: 404 });

    const pastSince = new Date(Date.now() - PAST_MEALS_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const [pantryNames, recent, { data: listRows }, { data: pastRows }, { data: ideaRows }] = await Promise.all([
      getPantryNames(supabase, householdCode),
      getRecentPurchases(supabase, householdCode),
      supabase.from('shopping_list').select('item_name').eq('household_code', householdCode).eq('checked', false),
      supabase.from('meal_plan_days').select('meal').eq('household_code', householdCode).gte('plan_date', pastSince),
      supabase.from('meal_ideas').select('name').eq('household_code', householdCode),
    ]);

    const recentLines = [...recent.values()].map((r) => `${r.name} (bought ${r.date})`);
    const pastMeals = [...new Set((pastRows ?? []).map((r) => r.meal as string))];
    const ideas = (ideaRows ?? []).map((r) => r.name as string);

    const prompt = `Suggest ${SUGGESTION_COUNT} dinners for a family of four to cook at home this week.

Favor, in this order:
1. Using up groceries they bought in the last ${RECENT_PURCHASE_DAYS} days (listed below), especially fresh meat and produce.
2. Meals like the ones they've planned before, and their saved ideas.
Vary the main protein and style across the ${SUGGESTION_COUNT}. Don't suggest any of these, which are already planned: ${exclude.length > 0 ? exclude.join('; ') : '(none)'}.

For each dinner give:
- "meal": short, the way a family writes it ("Teriyaki chicken + rice + broccoli").
- "reason": under 8 words, specific ("Uses the chicken thighs from Oct 11", "A family favorite").
- "ingredients": 3 to 12 grocery ingredients, main ones first. If a household item name below is the same product (even with a size, brand or variety), use that name exactly; otherwise a short grocery name. Leave out water, salt, black pepper and cooking oil.

Bought recently:
${recentLines.length > 0 ? recentLines.join('\n') : '(nothing recorded)'}

Meals planned before:
${pastMeals.length > 0 ? pastMeals.join('\n') : '(none yet)'}

Saved ideas:
${ideas.length > 0 ? ideas.join('\n') : '(none)'}

Household item names:
${pantryNames.length > 0 ? pantryNames.join('\n') : '(none yet)'}

Respond with JSON only: {"suggestions":[{"meal":"...","reason":"...","ingredients":["..."]}]}`;

    const ai = await generateJson<{ suggestions?: { meal?: string; reason?: string; ingredients?: unknown }[] }>(prompt);

    const resolve = nameResolver(pantryNames);
    const onList = new Set((listRows ?? []).map((r) => (r.item_name as string).toLowerCase()));
    const excluded = new Set(exclude.map(mealKey));
    const seen = new Set<string>();
    const clean = (v: unknown) => String(v || '').trim().slice(0, 120);

    const suggestions: MealSuggestion[] = (ai.suggestions ?? [])
      .map((s) => {
        const meal = clean(s.meal);
        const names = Array.isArray(s.ingredients) ? [...new Set(s.ingredients.map((i) => resolve(clean(i))).filter(Boolean))].slice(0, 15) : [];
        const ingredients: SuggestionIngredient[] = names.map((name) => {
          // On the list wins over a recent purchase: it means they need more
          if (onList.has(name.toLowerCase())) return { name, status: 'list' };
          const bought = recent.get(name.toLowerCase());
          if (bought) return { name, status: 'have', bought: bought.date };
          return { name, status: 'buy' };
        });
        return { meal: meal.charAt(0).toUpperCase() + meal.slice(1), reason: clean(s.reason), ingredients };
      })
      .filter((s) => {
        const key = mealKey(s.meal);
        if (!s.meal || s.ingredients.length === 0 || excluded.has(key) || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, SUGGESTION_COUNT);

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Error suggesting meals:', error);
    return NextResponse.json({ error: 'Could not suggest dinners right now. Please try again.' }, { status: 500 });
  }
}
