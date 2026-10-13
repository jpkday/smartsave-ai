import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { generateJson } from '../../../lib/gemini';
import { addDays, fromDateStr, toDateStr, NoteImport } from '../../../lib/meals';
import { getPantryNames } from '../../../lib/pantry';

// Reads a pasted note (e.g. a shared Apple Note with the week's dinners and a few
// groceries) and sorts it into the week's days, meal ideas, and grocery items.
// Nothing is saved here; the page shows the result for review first.

const MAX_TEXT = 5000;
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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
    const text = String(body.text || '').trim().slice(0, MAX_TEXT);
    const weekStart = String(body.week_start || '');

    if (!householdCode || !text || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      return NextResponse.json({ error: 'household_code, text and week_start are required' }, { status: 400 });
    }
    const { data: household } = await supabase.from('households').select('code').eq('code', householdCode).maybeSingle();
    if (!household) return NextResponse.json({ error: 'Unknown household' }, { status: 404 });

    const start = fromDateStr(weekStart);
    const dates = WEEKDAYS.map((_, i) => toDateStr(addDays(start, i)));
    const weekLines = WEEKDAYS.map((day, i) => `${day} = ${dates[i]}`).join('\n');
    const pantryNames = await getPantryNames(supabase, householdCode);

    const prompt = `A family keeps their dinner plan and some groceries in a shared note. Sort the note below.

The week being planned:
${weekLines}

Return:
- "days": dinners tied to a day. Use the weekday (or date) written in the note to pick the date from the week above. If dinners are listed in order without days, assign them Monday onward. Only dinners, written short like the note ("Chicken tacos").
- "ideas": meals mentioned without a day, or listed as options/ideas.
- "grocery_items": things to buy that are not meals (e.g. "milk", "paper towels", "2 lb ground beef"). If a household item name below is the same product (even when it adds a size, brand or variety, e.g. "bananas" → "Bananas (3 lb)"), use that household name exactly; only use a new short grocery name when nothing matches.
- Write dinners and ideas with a capital first letter ("Chicken tacos").
Ignore anything that is neither. Do not invent entries.

Household item names:
${pantryNames.length > 0 ? pantryNames.join('\n') : '(none yet)'}

Note:
"""
${text}
"""

Respond with JSON only: {"days":[{"date":"YYYY-MM-DD","meal":"..."}],"ideas":["..."],"grocery_items":["..."]}`;

    const ai = await generateJson<Partial<NoteImport>>(prompt);
    const clean = (v: unknown) => String(v || '').trim().slice(0, 120);
    const capitalize = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);
    const validDates = new Set(dates);

    const seenDates = new Set<string>();
    const days = (Array.isArray(ai.days) ? ai.days : [])
      .map((d) => ({ date: clean(d?.date), meal: capitalize(clean(d?.meal)) }))
      .filter((d) => d.meal && validDates.has(d.date) && !seenDates.has(d.date) && seenDates.add(d.date));

    const result: NoteImport = {
      days,
      ideas: [...new Set((Array.isArray(ai.ideas) ? ai.ideas : []).map((v) => capitalize(clean(v))).filter(Boolean))].slice(0, 30),
      grocery_items: [...new Set((Array.isArray(ai.grocery_items) ? ai.grocery_items : []).map(clean).filter(Boolean))].slice(0, 30),
    };
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error importing note:', error);
    return NextResponse.json({ error: 'Could not read that note. Please try again.' }, { status: 500 });
  }
}
