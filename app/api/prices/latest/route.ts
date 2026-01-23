import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
    try {
        const { item_name, store_id } = await req.json();

        if (!item_name || !store_id) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const householdCode = req.headers.get('x-household-code');
        if (!householdCode) {
            return NextResponse.json({ error: "Missing x-household-code header" }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Find item by name
        const { data: items } = await supabase
            .from('items')
            .select('id')
            .eq('household_code', householdCode)
            .ilike('name', item_name)
            .limit(1);

        if (!items || items.length === 0) {
            return NextResponse.json({ price: null, days_ago: null });
        }

        // Get latest price for this item at this store
        const { data: prices } = await supabase
            .from('price_history')
            .select('price, recorded_date')
            .eq('household_code', householdCode)
            .eq('item_id', items[0].id)
            .eq('store_id', store_id)
            .order('recorded_date', { ascending: false })
            .limit(1);

        if (!prices || prices.length === 0) {
            return NextResponse.json({ price: null, days_ago: null });
        }

        const latestPrice = prices[0];
        const daysSince = Math.floor(
            (Date.now() - new Date(latestPrice.recorded_date).getTime()) / (1000 * 60 * 60 * 24)
        );

        return NextResponse.json({
            price: latestPrice.price,
            days_ago: daysSince
        });

    } catch (error: any) {
        console.error("Latest Price Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch latest price" },
            { status: 500 }
        );
    }
}
