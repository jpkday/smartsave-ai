
import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// HARDCODED STORE ID (Costco)
const STORE_ID = '3b6c4615-ba8d-453f-be8c-771946c4b713';

async function main() {
    console.log("🚀 Starting Costco Recorder (Smart SKU Matching)");
    console.log(`Using Store ID: ${STORE_ID}`);

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    let itemsSaved = 0;
    const processedThisRun = new Set();

    context.on('response', async (response) => {
        try {
            if (response.headers()['content-type']?.includes('application/json')) {
                const json = await response.json();
                const items = findPotentialItems(json);

                if (items.length > 0) {
                    // Filter duplicates in this batch
                    const uniqueItems = items.filter(i => {
                        const key = i.sku || i.name;
                        if (processedThisRun.has(key)) return false;
                        processedThisRun.add(key);
                        return true;
                    });

                    if (uniqueItems.length > 0) {
                        console.log(`\n📦 Found ${uniqueItems.length} items. Processing...`);

                        for (const item of uniqueItems) {
                            await upsertSmartItem(item);
                        }
                    }
                }
            }
        } catch (e) { /* ignore */ }
    });

    await page.goto('https://sameday.costco.com/store/costco/storefront');
    console.log("👀 Browsing... Go ahead and click around!");

    await new Promise(() => { });
}

async function upsertSmartItem(data: any) {
    const { name, sku, price, image, category: catString } = data;
    if (!name || !sku) return;

    // 1. Get/Create Category
    let catId = null;
    const cleanCat = catString || 'Uncategorized';
    const { data: catData } = await supabase.from('categories').select('id').ilike('name', cleanCat).single();
    if (catData) catId = catData.id;
    else {
        const { data: newCat } = await supabase.from('categories').insert({ name: cleanCat }).select('id').single();
        catId = newCat?.id;
    }

    let itemId = null;
    let createdNew = false;

    // 2A. TRY FINDING BY SKU FIRST (The Store-Specific Link)
    const { data: existingSkuLink } = await supabase
        .from('store_item_sku')
        .select('item_id')
        .eq('store_id', STORE_ID)
        .eq('store_sku', sku)
        .single();

    if (existingSkuLink) {
        itemId = existingSkuLink.item_id;
        // console.log(`   Start: SKU Match found (Item ID: ${itemId})`);
    }
    else {
        // 2B. FALLBACK: FIND BY NAME (If SKU not linked yet)
        const { data: existingItem } = await supabase.from('items').select('id').eq('name', name).single();
        if (existingItem) {
            itemId = existingItem.id;
            // console.log(`   Start: Name Match found (Item ID: ${itemId})`);
        }
    }

    // 3. EXECUTE LOGIC
    if (itemId) {
        // ITEM EXISTS -> Update & Alias

        // A. Update Image if missing
        if (image) {
            const { error } = await supabase.from('items').update({ image_url: image }).eq('id', itemId).is('image_url', null);
            if (!error) { /* silently updated */ }
        }

        // B. Add Alias if name is DIFFERENT (Smart Aliasing)
        // We need to fetch current name to compare
        const { data: currentItem } = await supabase.from('items').select('name').eq('id', itemId).single();
        if (currentItem && currentItem.name !== name) {
            console.log(`   alias: "${name}" -> Item: "${currentItem.name}"`);
            // Try to insert alias, ignore if it already exists (unique constraint)
            const { error: aliasError } = await supabase.from('item_aliases').insert({
                item_id: itemId,
                alias: name,
                store_id: STORE_ID
            });
            // Silently ignore unique constraint violations (code 23505)
            if (aliasError && !aliasError.message.includes('duplicate') && !aliasError.code?.includes('23505')) {
                console.error('   alias insert error:', aliasError);
            }
        } else {
            console.log(`   update: [${sku}] ${name}`);
        }

        // C. Link SKU (Upsert ensures connection)
        await supabase.from('store_item_sku').upsert({
            store_id: STORE_ID,
            item_id: itemId,
            store_sku: sku
        }, { onConflict: 'store_id,item_id' });

    } else {
        // ITEM DOES NOT EXIST -> Create New
        let unit = 'count';
        if (name.match(/lb/i)) unit = 'lb';
        else if (name.match(/oz/i)) unit = 'oz';
        else if (name.match(/kg/i)) unit = 'kg';
        else if (name.match(/gal/i)) unit = 'gal';

        const { data: newItem, error } = await supabase.from('items').insert({
            name: name,
            category_id: catId,
            image_url: image,
            unit: unit,
            household_code: 'ASDF'
        }).select('id').single();

        if (newItem) {
            itemId = newItem.id;
            // Create SKU Link
            await supabase.from('store_item_sku').insert({
                store_id: STORE_ID,
                item_id: itemId,
                store_sku: sku
            });
            console.log(`   create: [${sku}] ${name}`);
        } else {
            // console.error("Failed to create item:", error);
        }
    }
}

function findPotentialItems(obj: any, found: any[] = []) {
    if (!obj || typeof obj !== 'object') return found;

    // Costco/Instacart Item Pattern
    const isItem = (obj.name && (obj.viewSection?.retailerReferenceCodeString || obj.itemCode));

    if (isItem) {
        found.push({
            name: obj.name,
            sku: obj.viewSection?.retailerReferenceCodeString || obj.itemCode,
            price: obj.price?.viewSection?.priceString || obj.pricing?.priceString,
            image: obj.viewSection?.itemImage?.url || obj.image?.url || null,
            category: obj.viewSection?.trackingProperties?.product_category_name || obj.category
        });
    }

    if (Array.isArray(obj)) {
        obj.forEach(c => findPotentialItems(c, found));
    } else {
        Object.values(obj).forEach(c => findPotentialItems(c, found));
    }
    return found;
}

main();
