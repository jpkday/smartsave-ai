
import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// WALMART STORE ID
const STORE_ID = 'bd8e4c9f-3a5c-4fdb-a79e-de3de37868bc';
const DRY_RUN = false; // Set to false to actually write to DB

async function main() {
    console.log(`🚀 Starting Walmart Recorder ${DRY_RUN ? '(DRY RUN MODE)' : ''}`);
    console.log(`Using Store ID: ${STORE_ID}`);

    // Launch with Persistent Context (Saves Cookies/Login) & Stealth Args
    const userDataDir = path.resolve(__dirname, '../walmart-session');

    // @ts-ignore - launchPersistentContext types can be tricky
    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        viewport: null, // Full window
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-infobars',
            '--window-position=0,0',
            '--ignore-certifcate-errors',
            '--ignore-certifcate-errors-spki-list',
        ],
        ignoreDefaultArgs: ['--enable-automation'],
    });

    const page = await context.newPage();

    // Extra Stealth: Overwrite navigator properties
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const processedThisRun = new Set();

    context.on('response', async (response) => {
        const url = response.url();
        // Walmart API calls usually look like this or GraphQL
        if (url.includes('graphql') || url.includes('search') || url.includes('items') || response.headers()['content-type']?.includes('application/json')) {
            try {
                const json = await response.json();
                const items = findPotentialItems(json);

                if (items.length > 0) {
                    // Smart Deduplication: Prioritize items with UPCs
                    const batchMap = new Map();

                    items.forEach(item => {
                        const key = item.sku;
                        const existing = batchMap.get(key);

                        if (!existing) {
                            batchMap.set(key, item);
                        } else {
                            // Smart Merge: enhance existing record with missing data
                            if (item.upc && !existing.upc) existing.upc = item.upc;
                            if (item.price && !existing.price) existing.price = item.price;
                            if (item.image && !existing.image) existing.image = item.image;

                            batchMap.set(key, existing);
                        }
                    });

                    // Simplified: Just take values from batchMap.
                    const finalItems = Array.from(batchMap.values()).filter(i => {
                        if (processedThisRun.has(i.sku) && !i.upc) return false;
                        processedThisRun.add(i.sku);
                        return true;
                    });

                    if (finalItems.length > 0) {
                        console.log(`\n📦 Found ${finalItems.length} items (Unique). processing...`);
                        for (const item of finalItems) {
                            await upsertSmartItem(item);
                        }
                    }
                }
            } catch (e) { /* ignore non-json */ }
        }
    });

    // Start at Walmart Grocery
    await page.goto('https://www.walmart.com/cp/groceries/976759');
    console.log("👀 Browsing... Go ahead and click around categories!");

    // Keep script alive indefinitely
    await new Promise(() => { });
}

// Recursively find objects that look like Walmart Products
function findPotentialItems(obj: any, found: any[] = []) {
    if (!obj || typeof obj !== 'object') return found;

    // Identifying traits of a Walmart Product Object in JSON
    // Usually has "usItemId", "name", "priceInfo", "imageInfo"
    const isItem = (obj.usItemId && obj.name);

    if (isItem) {
        // Extract Data
        const sku = obj.usItemId;
        const name = obj.name;
        const upc = obj.upc || obj.gtin || obj.wupc || null; // standard checks

        // Price structure varies wildly
        let price = 0;
        if (obj.priceInfo?.currentPrice?.price) price = obj.priceInfo.currentPrice.price;
        else if (obj.price) price = obj.price;
        else if (obj.currentPrice) price = obj.currentPrice;
        else if (obj.priceInfo?.price) price = obj.priceInfo.price;
        else if (obj.offerPrice) price = obj.offerPrice;

        // Image structure varies
        const image = obj.imageInfo?.thumbnailUrl || obj.imageInfo?.url || obj.image || null;

        found.push({ name, sku, price, image, upc, category: 'Uncategorized' });
    }

    if (Array.isArray(obj)) {
        obj.forEach(c => findPotentialItems(c, found));
    } else {
        Object.values(obj).forEach(c => findPotentialItems(c, found));
    }
    return found;
}

async function upsertSmartItem(data: any) {
    const { name, sku, price, image, upc } = data;
    if (!name || !sku) return;

    // 1. Check if Item exists by Web SKU match
    let itemId = null;

    const { data: existingLink } = await supabase
        .from('store_item_sku')
        .select('item_id')
        .eq('store_id', STORE_ID)
        .eq('store_sku', sku)
        .single();

    if (existingLink) {
        itemId = existingLink.item_id;
        console.log(`   [FOUND BY WEB SKU] ${name}`);
    }
    // 2. Try UPC Match (Bridge to Physical Receipt)
    else if (upc && upc.length >= 11) {
        // ALWAYS use Fuzzy Match (Root 11 digits) to ignore check-digit variances
        const rootUpc = upc.substring(0, 11);

        const { data: fuzzyMatch } = await supabase
            .from('store_item_sku')
            .select('item_id, store_sku')
            .eq('store_id', STORE_ID)
            .ilike('store_sku', `${rootUpc}%`) // Match any 12th digit
            .limit(1)
            .single();

        if (fuzzyMatch) {
            itemId = fuzzyMatch.item_id;
            console.log(`   [FOUND BY UPC] ${name} (Matches Root ${rootUpc} -> ${fuzzyMatch.store_sku})`);
        }
    }

    if (!itemId) {
        // 3. Check by Name match (Case Insensitive)
        const { data: nameMatch } = await supabase
            .from('items')
            .select('id, name')
            .ilike('name', name)
            .single();

        if (nameMatch) {
            itemId = nameMatch.id;
            console.log(`   [LINKED BY NAME] "${name}" -> Exists as "${nameMatch.name}"`);
        } else {
            // 4. Create New Item
            if (DRY_RUN) {
                console.log(`   [DRY RUN] Would CREATE: "${name}" (No SKU/UPC/Name Match)`);
            } else {
                const { data: newItem } = await supabase.from('items').insert({
                    name: name,
                    category_id: 1,
                    image_url: image,
                    unit: 'count',
                    household_code: 'ASDF'
                }).select('id').single();

                if (newItem) {
                    itemId = newItem.id;
                    console.log(`   [CREATED NEW] ${name}`);
                }
            }
        }
    }

    // 5. Link SKU & TRACK PRICE
    if (DRY_RUN) {
        console.log(`   [DRY RUN] Link Web SKU ${sku} -> Item ${itemId || 'NEW'}`);
        return;
    }

    if (itemId) {
        // A. Link Web SKU (so next time we find it instantly)
        await supabase.from('store_item_sku').upsert({
            store_id: STORE_ID,
            item_id: itemId,
            store_sku: sku
        }, { onConflict: 'store_id,store_sku' });

        // A.2 Link UPC (if new)
        if (upc) {
            await supabase.from('store_item_sku').upsert({
                store_id: STORE_ID,
                item_id: itemId,
                store_sku: upc
            }, { onConflict: 'store_id,store_sku' });
        }

        // B. Track Price
        if (price) {
            const numericPrice = parseFloat(String(price).replace(/[^0-9.]/g, ''));
            if (!isNaN(numericPrice) && numericPrice > 0) {
                const { error: priceError } = await supabase.from('price_history').insert({
                    item_id: itemId,
                    price: numericPrice,
                    store_id: STORE_ID,
                    item_name: name,
                    recorded_date: new Date().toISOString(),
                    store: 'Walmart', // Legacy required field
                    source: 'scraper',
                    unit: 'each' // Default unit just in case
                });

                if (priceError) console.error(`   [PRICE ERROR] ${priceError.message}`);
                else console.log(`   💲 $${numericPrice}`);
            }
        }
    }
}

main();
