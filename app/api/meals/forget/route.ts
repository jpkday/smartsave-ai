import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { mealKey } from '../../../lib/meals';

// Forgets a dinner for a household: it's never suggested again, and if it was a
// favorite it's removed from favorites along with its saved ingredients. Past weeks
// that included it are left as they were.

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
    const meal = String(body.meal || '').trim().slice(0, 120);
    if (!householdCode || !meal) {
      return NextResponse.json({ error: 'household_code and meal are required' }, { status: 400 });
    }

    const { data: household, error: householdError } = await supabase
      .from('households')
      .select('code, dismissed_meals')
      .eq('code', householdCode)
      .maybeSingle();
    if (householdError) return NextResponse.json({ error: 'Could not forget that dinner' }, { status: 500 });
    if (!household) return NextResponse.json({ error: 'Unknown household' }, { status: 404 });

    const key = mealKey(meal);
    const dismissed = new Set<string>(Array.isArray(household.dismissed_meals) ? household.dismissed_meals : []);
    dismissed.add(key);
    const { error: updateError } = await supabase
      .from('households')
      .update({ dismissed_meals: [...dismissed] })
      .eq('code', householdCode);
    if (updateError) return NextResponse.json({ error: 'Could not forget that dinner' }, { status: 500 });

    // Drop it from favorites (matched by normalized name) and its saved ingredients
    const { data: ideas } = await supabase.from('meal_ideas').select('id, name').eq('household_code', householdCode);
    const ideaIds = (ideas ?? []).filter((i) => mealKey(i.name) === key).map((i) => i.id);
    if (ideaIds.length > 0) await supabase.from('meal_ideas').delete().in('id', ideaIds);
    await supabase.from('meal_ingredients').delete().eq('household_code', householdCode).eq('meal_key', key);

    return NextResponse.json({ success: true, removed_favorite: ideaIds.length > 0 });
  } catch (error) {
    console.error('Error forgetting meal:', error);
    return NextResponse.json({ error: 'Could not forget that dinner' }, { status: 500 });
  }
}
