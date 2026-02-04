
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!); // Use Service Role for Deletes

async function main() {
    console.log("🕵️ Detecting Root-11 UPC Conflicts...");

    // 1. Find Conflicts
    // Meaning: Two DIFFERENT items have SKUs that share the same first 11 digits.

    // FETCH ALL LINKS
    const { data: allLinks } = await supabase
        .from('store_item_sku')
        .select('id, store_sku, item_id, store_id')
        .not('store_sku', 'is', null);

    if (!allLinks) return;

    // Group by Root-11
    const rootMap = new Map<string, Set<number>>();
    const conflictsFound: Array<{ root: string; storeId: string; itemIds: number[] }> = [];

    allLinks.forEach(link => {
        const sku = link.store_sku;
        if (sku.length < 11) return; // Skip short codes

        const root = sku.substring(0, 11);
        const compositeKey = `${link.store_id}:${root}`; // Store-specific conflicts

        if (!rootMap.has(compositeKey)) {
            rootMap.set(compositeKey, new Set([link.item_id]));
        } else {
            rootMap.get(compositeKey)!.add(link.item_id);
        }
    });

    // Identify Sets with > 1 Item ID
    for (const [key, itemSet] of rootMap.entries()) {
        if (itemSet.size > 1) {
            conflictsFound.push({
                root: key.split(':')[1],
                storeId: key.split(':')[0],
                itemIds: Array.from(itemSet).sort((a, b) => a - b) // Sort ID ascending (Winner first)
            });
        }
    }

    if (conflictsFound.length === 0) {
        console.log("✅ No Root-11 conflicts found!");
        return;
    }

    console.log(`⚠️ Found ${conflictsFound.length} Conflict Groups. Processing...`);

    for (const conflict of conflictsFound) {
        const winnerId = conflict.itemIds[0]; // Oldest Item (Keep)
        const loserIds = conflict.itemIds.slice(1); // Newer Items (Merge & Burn)

        console.log(`\n⚔️ Conflict Root: ${conflict.root}`);
        console.log(`   🏆 Winner: Item ${winnerId}`);
        console.log(`   🗑️ Merging: Items ${loserIds.join(', ')}`);

        for (const loserId of loserIds) {
            // A. Move Shopping History
            const { error: rError } = await supabase
                .from('shopping_list_events')
                .update({ item_id: winnerId })
                .eq('item_id', loserId);

            if (rError) console.error(`      Error moving shopping events: ${rError.message}`);

            // B. Move/Update Store SKUs
            // We need to fetch Loser's SKUs first
            const { data: loserSkus } = await supabase
                .from('store_item_sku')
                .select('*')
                .eq('item_id', loserId);

            if (loserSkus) {
                for (const skuRow of loserSkus) {
                    // Try to update Loser Link -> Winner Link
                    const { error: moveError } = await supabase
                        .from('store_item_sku')
                        .update({ item_id: winnerId })
                        .eq('id', skuRow.id);

                    if (moveError) {
                        // If update fails (e.g. Winner already has this exact SKU), just delete Loser Link
                        // console.log(`      (Duplicate SKU link, deleting loser link)`);
                        await supabase.from('store_item_sku').delete().eq('id', skuRow.id);
                    } else {
                        console.log(`      Moved SKU ${skuRow.store_sku} to Item ${winnerId}`);
                    }
                }
            }

            // C. Move Price History (Important!)
            const { error: pError } = await supabase
                .from('price_history')
                .update({ item_id: winnerId })
                .eq('item_id', loserId);
            if (pError) console.error(`      Error moving price history: ${pError.message}`);

            // D. Delete Loser Item
            const { error: delError } = await supabase
                .from('items')
                .delete()
                .eq('id', loserId);

            if (delError) console.error(`      ❌ Failed to delete Item ${loserId}: ${delError.message}`);
            else console.log(`      ✅ Deleted Item ${loserId}`);
        }
    }

    console.log("\n✨ Merge Complete!");
}

main();
