
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// Simple Levenshtein Distance for fuzzy matching
function levenshtein(a: string, b: string): number {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

async function main() {
    console.log("🕵️ Scanning for Duplicate Items...");

    // 1. Get all items
    const { data: items, error } = await supabase
        .from('items')
        .select('id, name, created_at, category_id');

    if (error || !items) { console.error("Error fetching items", error); return; }

    // 2. Get all SKU links (to know which items are "Smart")
    const { data: links } = await supabase
        .from('store_item_sku')
        .select('item_id');

    const linkedItemIds = new Set(links?.map(l => l.item_id));

    console.log(`Loaded ${items.length} items. Analyzing...`);

    const duplicates = [];
    const processed = new Set();

    // Sort by length to compare shorter names to longer ones (often 'Milk' vs 'Whole Milk')
    items.sort((a, b) => a.name.length - b.name.length);

    for (let i = 0; i < items.length; i++) {
        const itemA = items[i];
        if (processed.has(itemA.id)) continue;

        for (let j = i + 1; j < items.length; j++) {
            const itemB = items[j];
            if (processed.has(itemB.id)) continue;

            const nameA = itemA.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            const nameB = itemB.name.toLowerCase().replace(/[^a-z0-9]/g, '');

            // Checks:
            // 1. Exact match (ignore case/generated junk)
            // 2. One contains the other AND diff is small
            // 3. Levenshtein distance is small

            let isMatch = false;
            let method = '';

            if (nameA === nameB) {
                isMatch = true;
                method = 'Exact Name';
            }
            else if (nameB.includes(nameA) && nameB.length - nameA.length < 5) {
                isMatch = true;
                method = 'Substring';
            }
            else {
                const dist = levenshtein(nameA, nameB);
                if (dist <= 2) { // Allow 2 typos
                    isMatch = true;
                    method = 'Fuzzy';
                }
            }

            if (isMatch) {
                // Determine which one is "Better" (Linked > Unlinked)
                const isALinked = linkedItemIds.has(itemA.id);
                const isBLinked = linkedItemIds.has(itemB.id);

                let keep = itemA;
                let junk = itemB;

                if (isBLinked && !isALinked) { keep = itemB; junk = itemA; }
                else if (isALinked && !isBLinked) { keep = itemA; junk = itemB; }
                else {
                    // Tie-breaker: Keep the older one, or shorter name?
                    // Keep shorter name usually cleaner
                    if (itemB.name.length < itemA.name.length) { keep = itemB; junk = itemA; }
                }

                duplicates.push({
                    keep: `${keep.name} (ID: ${keep.id}) ${linkedItemIds.has(keep.id) ? '🔗' : ''}`,
                    delete: `${junk.name} (ID: ${junk.id}) ${linkedItemIds.has(junk.id) ? '🔗' : ''}`,
                    method
                });

                processed.add(junk.id); // Don't match this junk again
            }
        }
    }

    // Output Report
    if (duplicates.length === 0) {
        console.log("✅ No obvious duplicates found!");
    } else {
        console.log(`⚠️ Found ${duplicates.length} Potential Duplicates:\n`);
        duplicates.forEach(d => {
            console.log(`   KEEP:   ${d.keep}`);
            console.log(`   DELETE: ${d.delete}`);
            console.log(`   Reason: ${d.method}`);
            console.log('   -------------------------');
        });

        console.log("\nTo fix these, manually delete the 'DELETE' items in the App/DB,");
        console.log("or merge their receipts to the 'KEEP' item ID.");
    }
}

main();
