
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function main() {
    // Hacky way to list tables via Postgrest if exposure allows
    // Usually invalid, but we can try to infer from common names

    // Better: Run a raw SQL query if we had a sql RUNNER tool hooked up to node.
    // We don't.

    // We can try to just select * from likely tables and see which one doesn't error.
    const candidates = ['receipts', 'receipt_items', 'receipt_lines', 'transaction_items', 'purchases', 'scanned_items'];

    for (const table of candidates) {
        const { error } = await supabase.from(table).select('*').limit(1);
        if (!error) {
            console.log(`✅ Table exists: ${table}`);
        } else {
            console.log(`❌ Table not found: ${table} (${error.code})`);
        }
    }
}
main();
