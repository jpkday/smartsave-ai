import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { generateJson } from '../../../lib/gemini';
import { mealKey, MealSuggestion, SuggestionIngredient } from '../../../lib/meals';
import { getPantryNames, getHaveItems, nameResolver, toHouseholdNames, RECENT_PURCHASE_DAYS } from '../../../lib/pantry';
import { MEAL_TEMPLATES, proteinFamily, templateFor } from '../../../lib/mealTemplates';
import { avoidPromptLine, containsAvoided, getAvoidFoods, getDismissedMeals } from '../../../lib/preferences';

// Suggests dinners for the week from what the household bought recently (to use it
// up), meals they've planned before, and their ideas list. Each ingredient is marked
// as probably at home (bought recently), already on the list, or still to buy.

// AI asks for a short batch; the instant list returns everything worth showing
const SUGGESTION_COUNT = 6;
const INSTANT_SUGGESTION_MAX = 20;
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
      ? body.exclude.map((m: unknown) => String(m || '').trim().slice(0, 120)).filter(Boolean).slice(0, 30)
      : [];
    if (!householdCode) return NextResponse.json({ error: 'household_code is required' }, { status: 400 });

    const { data: household } = await supabase.from('households').select('code').eq('code', householdCode).maybeSingle();
    if (!household) return NextResponse.json({ error: 'Unknown household' }, { status: 404 });

    const pastSince = new Date(Date.now() - PAST_MEALS_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const [pantryNames, recent, { data: listRows }, { data: pastRows }, { data: ideaRows }, avoid, dismissed] = await Promise.all([
      getPantryNames(supabase, householdCode),
      getHaveItems(supabase, householdCode),
      supabase.from('shopping_list').select('item_name').eq('household_code', householdCode).eq('checked', false),
      supabase.from('meal_plan_days').select('meal').eq('household_code', householdCode).gte('plan_date', pastSince),
      supabase.from('meal_ideas').select('name').eq('household_code', householdCode),
      getAvoidFoods(supabase, householdCode),
      getDismissedMeals(supabase, householdCode),
    ]);

    const recentLines = [...recent.values()].map((r) => `${r.name} (bought ${r.date})`);
    const pastMeals = [...new Set((pastRows ?? []).map((r) => r.meal as string))];
    const ideas = (ideaRows ?? []).map((r) => r.name as string);

    // Without the AI: the household's favorites and past dinners first (their own
    // ingredient lists), then built-in everyday dinners, each ranked by how many
    // ingredients were bought recently
    const historySuggestions = async () => {
      const { data: savedRows } = await supabase
        .from('meal_ingredients')
        .select('meal_key, item_name, sort_order')
        .eq('household_code', householdCode)
        .order('sort_order', { ascending: true });
      const savedByKey = new Map<string, string[]>();
      (savedRows ?? []).forEach((r) => savedByKey.set(r.meal_key, [...(savedByKey.get(r.meal_key) ?? []), r.item_name]));

      const candidates = [...[...recent.values()].map((r) => r.name), ...pantryNames];
      const shortDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const usesLine = (name: string, date: string) =>
        `uses the ${name.split(',')[0].replace(/\s*\(.*$/, '').toLowerCase()} from ${shortDate(date)}`;
      const rate = (ingredients: string[]) => {
        const haveNames = ingredients.filter((n) => recent.has(n.toLowerCase()));
        const protein = proteinFamily(ingredients);
        const proteinHave = haveNames.find((n) => n.toLowerCase().includes(protein));
        return {
          protein,
          haveCount: haveNames.length,
          bought: proteinHave ? recent.get(proteinHave.toLowerCase()) : undefined,
          score: haveNames.length - (ingredients.length - haveNames.length) * 0.3,
        };
      };

      // The household's own dinners: past plans and favorites
      const timesPlanned = new Map<string, number>();
      (pastRows ?? []).forEach((r) => timesPlanned.set(mealKey(r.meal as string), (timesPlanned.get(mealKey(r.meal as string)) ?? 0) + 1));
      const ownMeals = new Map<string, { meal: string; favorite: boolean }>();
      ideas.forEach((meal) => ownMeals.set(mealKey(meal), { meal, favorite: true }));
      (pastRows ?? []).forEach((r) => {
        const key = mealKey(r.meal as string);
        if (!ownMeals.has(key) && savedByKey.has(key)) ownMeals.set(key, { meal: r.meal as string, favorite: false });
      });
      const own = [...ownMeals.entries()]
        .map(([key, { meal, favorite }]) => {
          const template = savedByKey.has(key) ? null : templateFor(meal);
          const ingredients = savedByKey.get(key) ?? (template ? toHouseholdNames(template.ingredients, candidates) : []);
          const { bought, haveCount, score } = rate(ingredients);
          const times = timesPlanned.get(key) ?? 0;
          const why = bought ? usesLine(bought.name, bought.date) : haveCount >= 2 ? `you have ${haveCount} of the ingredients` : '';
          const reason = favorite
            ? why ? `Favorite · ${why}` : 'One of your favorites'
            : times > 1 ? `You've made this ${times} times` : why ? why.charAt(0).toUpperCase() + why.slice(1) : 'One of your recent dinners';
          return { meal, reason, ingredients, score: score + (favorite ? 1 : 0) + Math.min(times, 3) * 0.5 };
        })
        .filter((m) => m.ingredients.length > 0)
        .sort((a, b) => b.score - a.score);
      // Rotate so "new suggestions" brings up other favorites
      const ownOffset = Number.isInteger(body.seed) && own.length > 0 ? Math.abs(body.seed) % own.length : 0;
      const ownRotated = [...own.slice(ownOffset), ...own.slice(0, ownOffset)];

      // Built-in recipes that are really one of the household's own dinners aren't repeated
      const ownAsTemplates = new Set([...ownMeals.values()].map(({ meal }) => templateFor(meal)?.meal).filter(Boolean));
      const scored = MEAL_TEMPLATES
        .filter((t) => !ownMeals.has(mealKey(t.meal)) && !ownAsTemplates.has(t.meal))
        .filter((t) => !containsAvoided([t.meal, ...t.ingredients].join(' | '), avoid))
        .map((t) => {
          const ingredients = toHouseholdNames(t.ingredients, candidates);
          const { protein, bought, haveCount, score } = rate(ingredients);
          return {
            meal: t.meal,
            protein,
            reason: bought
              ? usesLine(bought.name, bought.date).replace(/^u/, 'U')
              : haveCount >= 2
                ? `You have ${haveCount} of the ${ingredients.length} ingredients`
                : 'An easy family dinner',
            ingredients,
            score,
          };
        })
        .sort((a, b) => b.score - a.score);
      // Spread the main protein: the best dinner for each protein first, then the rest
      const proteinsSeen = new Set<string>();
      const firstPass = scored.filter((t) => {
        if (proteinsSeen.has(t.protein)) return false;
        proteinsSeen.add(t.protein);
        return true;
      });
      const ordered = [...firstPass, ...scored.filter((t) => !firstPass.includes(t))];
      // Rotate within the best dozen so "new suggestions" gives a different set
      const top = ordered.slice(0, 12);
      const offset = Number.isInteger(body.seed) ? Math.abs(body.seed) % top.length : 0;
      const fromTemplates = [...top.slice(offset), ...top.slice(0, offset)];

      // Mostly the household's own dinners, with one slot for something new
      const ownSlots = SUGGESTION_COUNT - 1;
      return [...ownRotated.slice(0, ownSlots), ...fromTemplates.slice(0, 1), ...ownRotated.slice(ownSlots), ...fromTemplates.slice(1)];
    };

    const prompt = `Suggest ${SUGGESTION_COUNT} dinners for a family of four to cook at home this week.

Favor, in this order:
1. Using up groceries they bought in the last ${RECENT_PURCHASE_DAYS} days (listed below), especially fresh meat and produce.
2. Their favorite dinners and meals like the ones they've planned before.
Vary the main protein and style across the ${SUGGESTION_COUNT}. ${avoidPromptLine(avoid)} Don't suggest any of these, which are already planned: ${exclude.length > 0 ? exclude.join('; ') : '(none)'}. The household has also ruled these out: ${dismissed.size > 0 ? [...dismissed].join('; ') : '(none)'}.

For each dinner give:
- "meal": short, the way a family writes it ("Teriyaki chicken + rice + broccoli").
- "reason": under 8 words, specific ("Uses the chicken thighs from Oct 11", "A family favorite").
- "ingredients": 3 to 12 grocery ingredients, main ones first. If a household item name below is the same product (even with a size, brand or variety), use that name exactly; otherwise a short grocery name. Leave out water, salt, black pepper and cooking oil.

Bought recently:
${recentLines.length > 0 ? recentLines.join('\n') : '(nothing recorded)'}

Meals planned before:
${pastMeals.length > 0 ? pastMeals.join('\n') : '(none yet)'}

Their favorite dinners:
${ideas.length > 0 ? ideas.join('\n') : '(none)'}

Household item names:
${pantryNames.length > 0 ? pantryNames.join('\n') : '(none yet)'}

Respond with JSON only: {"suggestions":[{"meal":"...","reason":"...","ingredients":["..."]}]}`;

    // Default is instant: past dinners plus built-in recipes. The AI is only asked
    // when the household taps "More ideas" (mode: 'ai').
    type RawSuggestion = { meal?: string; reason?: string; ingredients?: unknown };
    let raw: RawSuggestion[] = [];
    let source: 'ai' | 'history' = 'history';
    if (body.mode === 'ai') {
      try {
        raw = (await generateJson<{ suggestions?: RawSuggestion[] }>(prompt)).suggestions ?? [];
        source = 'ai';
      } catch (err) {
        console.error('AI suggestions unavailable:', err instanceof Error ? err.message : err);
      }
    } else {
      raw = await historySuggestions();
    }

    const resolve = nameResolver(pantryNames);
    const onList = new Set((listRows ?? []).map((r) => (r.item_name as string).toLowerCase()));
    const excluded = new Set(exclude.map(mealKey));
    const seen = new Set<string>();
    const clean = (v: unknown) => String(v || '').trim().slice(0, 120);

    const suggestions: MealSuggestion[] = raw
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
        if (!s.meal || s.ingredients.length === 0 || excluded.has(key) || dismissed.has(key) || seen.has(key)) return false;
        // AI ideas must respect foods the household doesn't eat
        if (source === 'ai' && containsAvoided([s.meal, ...s.ingredients.map((i) => i.name)].join(' | '), avoid)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, source === 'ai' ? SUGGESTION_COUNT : INSTANT_SUGGESTION_MAX);

    return NextResponse.json({ suggestions, source });
  } catch (error) {
    console.error('Error suggesting meals:', error);
    return NextResponse.json({ error: 'Could not suggest dinners right now. Please try again.' }, { status: 500 });
  }
}
