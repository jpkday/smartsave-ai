import { createClient } from '@supabase/supabase-js';

import { NextRequest, NextResponse } from 'next/server';

const SHARED_USER_ID = '00000000-0000-0000-0000-000000000000';

export async function POST(request: NextRequest) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        if (!supabaseServiceKey) {
            return NextResponse.json({ error: 'Server misconfiguration: Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { trip_id, store_id, household_code } = await request.json();

        if (!trip_id || !store_id || !household_code) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. End the trip
        const { error: tripError } = await supabase
            .from('trips')
            .update({ ended_at: new Date().toISOString() })
            .eq('id', trip_id);

        if (tripError) throw tripError;

        // 2. CLEANUP: Delete CHECKED items for this store from the shopping list
        // We first need to find which items on the list belong to this store
        // Logic: Find items on the list that are CHECKED, then verify if they have a price at this store
        // OR just rely on the fact that if they are checked and 'pinned' to this store in the UI context, 
        // effectively we want to clear them.
        // robust way: Get all checked items, check their history/price or simpler:

        // The user wants to "clean up". 
        // We will delete ALL checked items for this household, assuming they were part of this trip?
        // Dangerous if multi-store...
        // Safer: Get items that have a shopping_list_event for THIS trip.

        const { data: events } = await supabase
            .from('shopping_list_events')
            .select('item_id')
            .eq('trip_id', trip_id);

        if (events && events.length > 0) {
            const itemIdsToCheck = events.map(e => e.item_id);

            const { error: deleteError } = await supabase
                .from('shopping_list')
                .delete()
                .eq('household_code', household_code)
                .eq('checked', true)
                .in('item_id', itemIdsToCheck);

            if (deleteError) console.error('Error cleaning up list:', deleteError);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error ending trip:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
