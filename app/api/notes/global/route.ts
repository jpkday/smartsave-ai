import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        if (!supabaseServiceKey) {
            return NextResponse.json({ error: 'Server misconfiguration: Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { data: notes, error } = await supabase
            .from('item_notes')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: true }); // Oldest first, so client iteration leaves newest as winner

        if (error) {
            console.error('Supabase fetch error:', error);
            throw error;
        }

        return NextResponse.json({ notes });
    } catch (error) {
        console.error('Error fetching global notes:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
