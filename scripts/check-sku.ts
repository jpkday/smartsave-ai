
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const WALMART_ID = 'bd8e4c9f-3a5c-4fdb-a79e-de3de37868bc';
const WEBSKU = '129540859';
const UPC = '062110955496';

async function main() {
    console.log("🕵️ Checking Database for Jus-Rol...");

    // Check Web SKU
    const { data: web } = await supabase.from('store_item_sku').select('*').eq('store_sku', WEBSKU);
    console.log(`Web SKU (${WEBSKU}):`, web);

    // Check UPC
    const { data: upc } = await supabase.from('store_item_sku').select('*').eq('store_sku', UPC);
    console.log(`UPC (${UPC}):`, upc);

    // Check Store ID constraint
    const { data: store } = await supabase.from('stores').select('id, name').eq('id', WALMART_ID);
    console.log("Walmart Store:", store);
}

main();
