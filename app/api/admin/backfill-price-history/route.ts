import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

const SHARED_USER_ID = '00000000-0000-0000-0000-000000000000';

export async function GET(request: NextRequest) {
    try {
        // 1. Fetch ALL shopping_list_events with a price
        const { data: events, error: eventsError } = await supabase
            .from('shopping_list_events')
            .select('item_id, item_name, store_id, store, price, checked_at, household_code')
            .not('price', 'is', null)
            .not('store_id', 'is', null) // Must have a store to record price history
            .not('item_id', 'is', null);

        if (eventsError || !events) {
            return NextResponse.json({ error: eventsError?.message || 'No events found' }, { status: 500 });
        }

        console.log(`[BACKFILL] Found ${events.length} events with price information.`);

        // 2. Process events into candidates
        // We want unique combinations of (item_id + store_id + price + recorded_date)
        // recorded_date should be YYYY-MM-DD derived from checked_at
        const candidates = new Map<string, any>();

        for (const event of events) {
            if (!event.checked_at) continue;

            const dateStr = new Date(event.checked_at).toISOString().slice(0, 10); // YYYY-MM-DD
            const priceVal = parseFloat(event.price);

            if (isNaN(priceVal)) continue;

            // Key for deduplication
            const key = `${event.item_id}-${event.store_id}-${priceVal.toFixed(2)}-${dateStr}`;

            if (!candidates.has(key)) {
                candidates.set(key, {
                    item_id: event.item_id,
                    item_name: event.item_name,
                    store_id: event.store_id,
                    store: event.store,
                    price: priceVal,
                    user_id: SHARED_USER_ID,
                    household_code: event.household_code,
                    recorded_date: dateStr,
                    created_at: new Date().toISOString()
                });
            }
        }

        console.log(`[BACKFILL] Identified ${candidates.size} unique price points.`);

        // 3. Check existing price_history to avoid duplicates
        // Fetching ALL might be heavy, but let's try to be smart or just fetch all for now
        // If the table is huge, this is bad. Assuming it's manageable for this household app.
        const { data: existing, error: existingError } = await supabase
            .from('price_history')
            .select('item_id, store_id, price, recorded_date')
            .eq('user_id', SHARED_USER_ID);

        if (existingError) {
            return NextResponse.json({ error: existingError.message }, { status: 500 });
        }

        const existingSet = new Set<string>();
        (existing || []).forEach((row: any) => {
            const p = parseFloat(row.price);
            const k = `${row.item_id}-${row.store_id}-${p.toFixed(2)}-${row.recorded_date}`;
            existingSet.add(k);
        });

        // 4. Filter out existing
        const toInsert: any[] = [];
        candidates.forEach((row, key) => {
            if (!existingSet.has(key)) {
                toInsert.push(row);
            }
        });

        console.log(`[BACKFILL] Found ${toInsert.length} new records to insert.`);

        // 5. Insert in batches (Supabase limit is usually batch size related)
        if (toInsert.length > 0) {
            const BATCH_SIZE = 100;
            for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
                const batch = toInsert.slice(i, i + BATCH_SIZE);
                const { error: insertError } = await supabase
                    .from('price_history')
                    .insert(batch);

                if (insertError) {
                    console.error('[BACKFILL] Batch insert error:', insertError);
                    // Continue trying other batches? Or fail? Let's fail for safety.
                    return NextResponse.json({ error: `Insert error: ${insertError.message}` }, { status: 500 });
                }
            }
        }

        return NextResponse.json({
            success: true,
            total_events_scanned: events.length,
            unique_price_points: candidates.size,
            already_existing: candidates.size - toInsert.length,
            newly_inserted: toInsert.length
        });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
