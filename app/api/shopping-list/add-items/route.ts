import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Adds items to a household's shopping list by name. Used by the weekly grocery-plan
// routine to push sale items for the meals that were picked. Like receipt upload,
// the household code is the only credential.

const SHARED_USER_ID = '00000000-0000-0000-0000-000000000000';
const MAX_ITEMS = 30;

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

function getSupabase() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseServiceKey) return null;
    return createClient(supabaseUrl, supabaseServiceKey);
}

async function householdExists(supabase: NonNullable<ReturnType<typeof getSupabase>>, code: string) {
    const { data } = await supabase.from('households').select('code').eq('code', code).maybeSingle();
    return !!data;
}

// GET ?household_code=ASDF&search=chicken — existing item names to reuse, most-bought first
export async function GET(request: NextRequest) {
    const supabase = getSupabase();
    if (!supabase) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });

    const householdCode = request.nextUrl.searchParams.get('household_code')?.toUpperCase();
    const search = request.nextUrl.searchParams.get('search')?.trim();
    if (!householdCode || !search) {
        return NextResponse.json({ error: 'household_code and search are required' }, { status: 400 });
    }
    if (!(await householdExists(supabase, householdCode))) {
        return NextResponse.json({ error: 'Unknown household' }, { status: 404 });
    }

    const { data: items, error } = await supabase
        .from('items')
        .select('id, name')
        .ilike('name', `%${escapeLike(search)}%`)
        .limit(50);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const ids = (items ?? []).map((i) => i.id);
    const { data: events } = ids.length
        ? await supabase.from('shopping_list_events').select('item_id').eq('household_code', householdCode).in('item_id', ids)
        : { data: [] };
    const counts: Record<number, number> = {};
    (events ?? []).forEach((e) => { counts[e.item_id] = (counts[e.item_id] || 0) + 1; });

    const results = (items ?? [])
        .map((i) => ({ name: i.name, times_purchased: counts[i.id] || 0 }))
        .sort((a, b) => b.times_purchased - a.times_purchased || a.name.localeCompare(b.name));
    return NextResponse.json({ items: results });
}

// POST { household_code, items: [{ name, category_id? }] }
// Reuses an item with the exact name (case-insensitive) or creates it, then adds it to the
// list unless it's already there unchecked.
export async function POST(request: NextRequest) {
    try {
        const supabase = getSupabase();
        if (!supabase) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });

        const body = await request.json();
        const householdCode = String(body.household_code || '').toUpperCase();
        const requested = Array.isArray(body.items) ? body.items : [];

        if (!householdCode || requested.length === 0) {
            return NextResponse.json({ error: 'household_code and items are required' }, { status: 400 });
        }
        if (requested.length > MAX_ITEMS) {
            return NextResponse.json({ error: `At most ${MAX_ITEMS} items per request` }, { status: 400 });
        }
        if (!(await householdExists(supabase, householdCode))) {
            return NextResponse.json({ error: 'Unknown household' }, { status: 404 });
        }

        const added: string[] = [];
        const skipped: string[] = [];
        const created: string[] = [];

        for (const entry of requested) {
            const name = String(entry?.name || '').trim().slice(0, 120);
            if (!name) continue;

            const { data: existing } = await supabase
                .from('items')
                .select('id, name')
                .ilike('name', escapeLike(name))
                .limit(1);

            let item = existing?.[0];
            if (!item) {
                const categoryId = Number.isInteger(entry?.category_id) ? entry.category_id : -1;
                const { data: newItem, error: createError } = await supabase
                    .from('items')
                    .insert({ name, category_id: categoryId, unit: 'count', household_code: householdCode })
                    .select('id, name')
                    .single();
                if (createError || !newItem) {
                    console.error('Error creating item:', name, createError);
                    continue;
                }
                item = newItem;
                created.push(item.name);
            }

            const { data: onList } = await supabase
                .from('shopping_list')
                .select('id')
                .eq('household_code', householdCode)
                .eq('item_id', item.id)
                .eq('checked', false)
                .limit(1);
            if (onList && onList.length > 0) {
                skipped.push(item.name);
                continue;
            }

            const { error: insertError } = await supabase.from('shopping_list').insert({
                item_id: item.id,
                item_name: item.name,
                quantity: 1,
                checked: false,
                is_priority: false,
                user_id: SHARED_USER_ID,
                household_code: householdCode,
            });
            if (insertError) {
                console.error('Error adding to list:', item.name, insertError);
                continue;
            }
            added.push(item.name);
        }

        return NextResponse.json({ success: true, added, skipped, created });
    } catch (error) {
        console.error('Error adding items:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
