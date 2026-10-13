import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { generateJson } from '../../../lib/gemini';
import { mealKey, MealIngredients } from '../../../lib/meals';
import { getPantryNames, getHaveItems, nameResolver, toHouseholdNames } from '../../../lib/pantry';
import { isNotCooking, templateFor } from '../../../lib/mealTemplates';
import { avoidPromptLine, getAvoidFoods } from '../../../lib/preferences';

// Turns a week of dinners into grocery ingredients. Meals this household has built
// before come from their saved ingredients; the rest are suggested by Gemini, matched
// to the household's own item names where possible. The household code is the
// credential, as with the other household endpoints.

const MAX_MEALS = 14;

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
    const meals: string[] = Array.isArray(body.meals)
      ? body.meals.map((m: unknown) => String(m || '').trim().slice(0, 120)).filter(Boolean)
      : [];

    if (!householdCode || meals.length === 0) {
      return NextResponse.json({ error: 'household_code and meals are required' }, { status: 400 });
    }
    if (meals.length > MAX_MEALS) {
      return NextResponse.json({ error: `At most ${MAX_MEALS} meals per request` }, { status: 400 });
    }
    const { data: household } = await supabase.from('households').select('code').eq('code', householdCode).maybeSingle();
    if (!household) return NextResponse.json({ error: 'Unknown household' }, { status: 404 });

    // One entry per distinct meal
    const uniqueMeals = [...new Map(meals.map((m) => [mealKey(m), m])).values()];
    const keys = uniqueMeals.map(mealKey);

    const [{ data: saved }, { data: listRows }, recent] = await Promise.all([
      supabase
        .from('meal_ingredients')
        .select('meal_key, item_name, sort_order')
        .eq('household_code', householdCode)
        .in('meal_key', keys)
        .order('sort_order', { ascending: true }),
      supabase
        .from('shopping_list')
        .select('item_name')
        .eq('household_code', householdCode)
        .eq('checked', false),
      getHaveItems(supabase, householdCode),
    ]);

    const savedByKey = new Map<string, string[]>();
    (saved ?? []).forEach((row) => {
      const list = savedByKey.get(row.meal_key) ?? [];
      list.push(row.item_name);
      savedByKey.set(row.meal_key, list);
    });

    const results = new Map<string, MealIngredients>();
    let aiUnavailable = false;
    uniqueMeals.forEach((meal) => {
      const savedList = savedByKey.get(mealKey(meal));
      if (savedList) results.set(mealKey(meal), { meal, ingredients: savedList, source: 'saved' });
    });

    const missing = uniqueMeals.filter((m) => !results.has(mealKey(m)));
    if (missing.length > 0) {
      const pantryNames = await getPantryNames(supabase, householdCode);
      const candidates = [...[...recent.values()].map((r) => r.name), ...pantryNames];

      // Built-in recipes answer instantly; only dishes they don't cover go to the AI
      const unknown: string[] = [];
      missing.forEach((meal) => {
        if (isNotCooking(meal)) {
          results.set(mealKey(meal), { meal, ingredients: [], source: 'none' });
          return;
        }
        const template = templateFor(meal);
        if (template) results.set(mealKey(meal), { meal, ingredients: toHouseholdNames(template.ingredients, candidates), source: 'basic' });
        else unknown.push(meal);
      });

      if (unknown.length > 0) {
        const avoid = await getAvoidFoods(supabase, householdCode);
        const prompt = `You help a family turn their dinner plan into a grocery list.
${avoidPromptLine(avoid)}

For each dinner below, list the grocery ingredients needed to cook it at home for a family of four.
Rules:
- When one of the household's own item names below fits an ingredient, use that name exactly.
- Otherwise use a short, generic grocery name with a size hint when natural, e.g. "Ground beef (lb)", "Tortillas, flour".
- Leave out water, salt, black pepper and cooking oil.
- 3 to 12 ingredients per meal, main ingredients first.
- If an entry is not a home-cooked meal (leftovers, eating out, takeout, "out", "TBD", a restaurant name), return an empty ingredients list.
- Keep each "meal" value exactly as given.

Household item names:
${pantryNames.length > 0 ? pantryNames.join('\n') : '(none yet)'}

Dinners:
${unknown.map((m) => `- ${m}`).join('\n')}

Respond with JSON only: {"meals":[{"meal":"<exactly as given>","ingredients":["..."]}]}`;

        const resolve = nameResolver(pantryNames);
        let ai: { meals?: { meal?: string; ingredients?: unknown }[] } | null = null;
        try {
          ai = await generateJson<{ meals?: { meal?: string; ingredients?: unknown }[] }>(prompt);
        } catch (err) {
          console.error('AI ingredients unavailable:', err instanceof Error ? err.message : err);
          aiUnavailable = true;
        }
        const aiByKey = new Map<string, string[]>();
        (ai?.meals ?? []).forEach((m) => {
          if (!m.meal) return;
          const ingredients = Array.isArray(m.ingredients)
            ? [...new Set(m.ingredients.map((i) => resolve(String(i || '').trim().slice(0, 120))).filter(Boolean))].slice(0, 15)
            : [];
          aiByKey.set(mealKey(m.meal), ingredients);
        });
        unknown.forEach((meal) => {
          const ingredients = aiByKey.get(mealKey(meal)) ?? [];
          results.set(mealKey(meal), { meal, ingredients, source: ingredients.length > 0 ? 'ai' : 'none' });
        });
      }
    }

    return NextResponse.json({
      meals: uniqueMeals.map((m) => results.get(mealKey(m))),
      on_list: (listRows ?? []).map((r) => r.item_name),
      recently_bought: [...recent.values()],
      ai_unavailable: aiUnavailable,
    });
  } catch (error) {
    console.error('Error building meal ingredients:', error);
    return NextResponse.json({ error: 'Could not build ingredients. Please try again.' }, { status: 500 });
  }
}
