
import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Note: Ideally use SERVICE_ROLE_KEY for admin writes, but using ANON for now as per project convention.
// If RLS blocks updates, user needs to export SERVICE_KEY.

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("Starting Enrichment Script...");

    // 1. Fetch Candidates
    const { data: items, error } = await supabase
        .from('items')
        .select('id, name')
        .is('category_id', null)
        .limit(20); // Process batch of 20

    if (error) {
        console.error("Supabase Error:", error);
        return;
    }

    if (!items || items.length === 0) {
        console.log("No uncategorized items found.");
        return;
    }

    console.log(`Found ${items.length} items to enriched.`);

    // 2. Launch Browser
    const browser = await chromium.launch({ headless: false }); // Headless: false to see what's happening
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    // 3. Process Items
    for (const item of items) {
        console.log(`\nProcessing: ${item.name} (${item.id})`);

        let matchedData: { category: string | null, image: string | null } | null = null;

        // Setup Interceptor
        // We listen for the GraphQL response that contains the search results.
        const responseHandler = async (response: any) => {
            const url = response.url();
            if (url.includes('graphql') || url.includes('v3/graphql')) {
                try {
                    const json = await response.json();

                    // Logic to find the item in the response
                    // This matches the structure we analyzed earlier
                    const placements = json.data?.searchResultsPlacements?.placements;
                    if (placements) {
                        const grid = placements.find((p: any) => p?.content?.__typename === 'SearchContentManagementSearchItemGrid');
                        if (grid?.content?.items?.length > 0) {
                            const firstItem = grid.content.items[0];
                            // Check match quality? For now, assume top result is correct.

                            const cat = firstItem.viewSection?.trackingProperties?.product_category_name || null;
                            const img = firstItem.viewSection?.itemImage?.url || firstItem.itemImage?.url || null;

                            if (cat || img) {
                                matchedData = { category: cat, image: img };
                            }
                        }
                    }
                } catch (e) {
                    // Ignore JSON parse errors for non-JSON interactions
                }
            }
        };

        page.on('response', responseHandler);

        try {
            const searchTerm = encodeURIComponent(item.name);
            const url = `https://sameday.costco.com/store/costco/search/${searchTerm}`;

            await page.goto(url, { waitUntil: 'domcontentloaded' });

            // Wait for some network activity to settle or a specific element
            // We wait for the item grid to likely appear
            try {
                await page.waitForSelector('ul[aria-label*="product"], [data-testid*="item_card"]', { timeout: 10000 });
            } catch (e) {
                console.log("  - Timeout waiting for grid (no results?)");
            }

            // Give a small buffer for the network response to be processed
            await page.waitForTimeout(2000);

            if (matchedData) {
                console.log("  + Found Data:", matchedData);

                // Update Supabase
                const updates: any = {};
                if ((matchedData as any).image) updates.image_url = (matchedData as any).image;

                // Handle Category
                if ((matchedData as any).category) {
                    // Get/Create Category ID
                    const catId = await getOrCreateCategory((matchedData as any).category);
                    if (catId) updates.category_id = catId;
                }

                if (Object.keys(updates).length > 0) {
                    const { error: updateError } = await supabase
                        .from('items')
                        .update(updates)
                        .eq('id', item.id);

                    if (updateError) console.error("  - DB Update Failed:", updateError.message);
                    else console.log("  + Item Updated in DB!");
                }
            } else {
                console.log("  - No data found via GraphQL interception.");
            }

        } catch (err) {
            console.error("  - Browser Error:", err);
        } finally {
            page.removeListener('response', responseHandler);
        }

        // Respectful pause
        await page.waitForTimeout(1000);
    }

    await browser.close();
    console.log("\nDone!");
}

async function getOrCreateCategory(name: string) {
    const cleanName = name.trim();
    if (!cleanName) return null;

    // Check exist
    const { data: existing } = await supabase
        .from('categories')
        .select('id')
        .ilike('name', cleanName)
        .single();

    if (existing) return existing.id;

    // Create
    const { data: newCat, error } = await supabase
        .from('categories')
        .insert({ name: cleanName })
        .select('id')
        .single();

    if (error) {
        console.error("    Error creating category:", cleanName);
        return null;
    }
    return newCat.id;
}

main().catch(console.error);
