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

        const { trip_id } = await request.json();

        if (!trip_id) {
            return NextResponse.json({ error: 'Missing trip_id' }, { status: 400 });
        }

        // 1. Delete associated events first (FK constraint)
        const { error: eventsError } = await supabase
            .from('shopping_list_events')
            .delete()
            .eq('trip_id', trip_id);

        if (eventsError) {
            console.error('Error deleting trip events:', eventsError);
            throw eventsError;
        }

        // 2. Delete the trip
        const { error } = await supabase
            .from('trips')
            .delete()
            .eq('id', trip_id);


        if (error) {
            console.error('Supabase delete error:', error);
            throw error;
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting trip:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
