
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const WALMART_ID = 'bd8e4c9f-3a5c-4fdb-a79e-de3de37868bc';

async function main() {
    console.log("Checking Walmart Prices...");

    const { count, error } = await supabase
        .from('price_history')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', WALMART_ID);

    console.log(`Total Price Entries for Walmart: ${count}`);

    if (count && count > 0) {
        const { data } = await supabase
            .from('price_history')
            .select('price, created_at, item_id')
            .eq('store_id', WALMART_ID)
            .order('created_at', { ascending: false })
            .limit(5);
        console.log("Recent Prices:", data);
    }
}
main();
