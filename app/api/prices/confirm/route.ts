import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const item_name = body.item_name?.trim();
        const {
            submission_id,
            price,
            store_id,
            unit_size,
            is_sale,
            sale_expiration
        } = body;

        console.log(`Confirming price for item: "${item_name}"`);

        if (!submission_id || !item_name || !price || !store_id) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        // Get household code from header
        const householdCode = req.headers.get('x-household-code');
        if (!householdCode) {
            return NextResponse.json({ error: "Missing x-household-code header" }, { status: 400 });
        }

        // Initialize Supabase
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json(
                { error: "Server configuration error" },
                { status: 500 }
            );
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Verify the submission exists and belongs to this household
        const { data: submission } = await supabase
            .from('price_submissions')
            .select('*')
            .eq('id', submission_id)
            .eq('household_code', householdCode)
            .single();

        if (!submission) {
            return NextResponse.json(
                { error: "Submission not found or access denied" },
                { status: 404 }
            );
        }

        // Find or create item
        let itemId = null;
        const { data: existingItems } = await supabase
            .from('items')
            .select('id, name')
            .ilike('name', item_name)
            .limit(1);

        if (existingItems && existingItems.length > 0) {
            itemId = existingItems[0].id;
        } else {
            // Create new item
            const { data: newItem, error: itemError } = await supabase
                .from('items')
                .insert({
                    household_code: householdCode,
                    name: item_name,
                })
                .select('id')
                .single();

            if (itemError) {
                throw new Error("Failed to create item: " + itemError.message);
            }
            itemId = newItem.id;
        }

        // Fetch store name
        const { data: storeData } = await supabase
            .from('stores')
            .select('name')
            .eq('id', store_id)
            .single();

        const storeName = storeData?.name || 'Unknown Store';

        const today = new Date().toISOString().split('T')[0];
        const SHARED_USER_ID = '00000000-0000-0000-0000-000000000000';

        // Add price to price_history table
        const { data: newPrice, error: priceError } = await supabase
            .from('price_history')
            .insert({
                household_code: householdCode,
                item_id: itemId,
                item_name: item_name,
                store_id: store_id,
                store: storeName,
                price: price,
                recorded_date: today,
                source: 'photo',
                user_id: SHARED_USER_ID,
                submitted_by: submission.user_id,
            })
            .select('id')
            .single();

        if (priceError) {
            throw new Error("Failed to save price: " + priceError.message);
        }

        // Mark submission as verified
        const { error: updateError } = await supabase
            .from('price_submissions')
            .update({
                verified: true,
                verified_at: new Date().toISOString(),
            })
            .eq('id', submission_id);

        if (updateError) {
            console.error("Failed to mark submission as verified:", updateError);
        }

        return NextResponse.json({
            success: true,
            price_id: newPrice.id,
            item_id: itemId,
            message: "Price added successfully!"
        });

    } catch (error: any) {
        console.error("Confirm Price Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to confirm price" },
            { status: 500 }
        );
    }
}
