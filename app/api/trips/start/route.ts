import { createClient } from '@supabase/supabase-js';

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        if (!supabaseServiceKey) {
            return NextResponse.json({ error: 'Server misconfiguration: Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { store_id, household_code } = await request.json();

        if (!store_id || !household_code) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Get store name
        const { data: store } = await supabase
            .from('stores')
            .select('name')
            .eq('id', store_id)
            .single();

        if (!store) {
            return NextResponse.json({ error: 'Store not found' }, { status: 404 });
        }

        // Close any other open trips for this store (safeguard)
        await supabase
            .from('trips')
            .update({ ended_at: new Date().toISOString() })
            .eq('store_id', store_id)
            .eq('household_code', household_code)
            .is('ended_at', null);

        // Create new trip
        const { data: trip, error } = await supabase
            .from('trips')
            .insert({
                store_id,
                store: store.name,
                household_code,
                started_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, trip });
    } catch (error) {
        console.error('Error starting trip:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
