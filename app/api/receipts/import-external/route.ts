import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
    try {
        const householdCode = req.headers.get('x-household-code');

        if (!householdCode) {
            return NextResponse.json({ error: "Missing x-household-code header" }, { status: 400 });
        }

        const data = await req.json();

        if (!data.items || data.items.length === 0) {
            return NextResponse.json({ error: "No items provided" }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Map source to store name for lookup
        const storeNameMap: Record<string, string> = {
            'walmart': 'Walmart',
            'costco': 'Costco'
        };

        const storeName = storeNameMap[data.source] || data.store || 'Unknown';

        // Find or create store
        let storeId = null;
        const { data: stores } = await supabase
            .from('stores')
            .select('id, name')
            .ilike('name', `%${storeName}%`);

        if (stores && stores.length > 0) {
            storeId = stores[0].id;
        }

        // Format OCR data to match expected structure
        const ocrData = {
            store: storeName,
            date: data.date || new Date().toISOString().split('T')[0],
            time: '12:00',
            items: data.items.map((item: any) => ({
                name: item.name,
                normalized_name: item.name, // Will be refined during import review
                price: item.price,
                quantity: item.quantity || 1,
                unit: 'each',
                is_weighted: false,
                sku: item.sku || '',
                ai_match: '' // Will be matched during import review
            })),
            should_add_trip: true,
            source: data.source || 'extension'
        };

        // Stage the receipt for review (same as photo uploads)
        const { data: inserted, error: dbError } = await supabase
            .from('imported_receipts')
            .insert({
                household_code: householdCode,
                store_id: storeId,
                image_url: `external:${data.source}`,
                ocr_data: ocrData,
                status: 'pending'
            })
            .select('id')
            .single();

        if (dbError) {
            console.error("DB Error:", dbError);
            return NextResponse.json({ error: "Failed to stage receipt: " + dbError.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            importId: inserted.id,
            message: `Receipt staged with ${data.items.length} items for review.`,
            itemCount: data.items.length
        });

    } catch (error: any) {
        console.error("Import External Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to import receipt" },
            { status: 500 }
        );
    }
}
