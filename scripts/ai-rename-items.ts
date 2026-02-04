
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Initialize Supabase
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Use Service Role for bulk updates
);

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const BATCH_SIZE = 20;

async function processBatch(items: any[]) {
    const prompt = `
    You are a professional grocery data formatter. 
    Rename the following Costco product titles into a structured format: "Noun, Details/Flavor, Brand (Size)".
    
    Rules:
    1. Start with the main generic noun (e.g., "Milk", "Chicken", "Socks").
    2. Follow with details or flavor (e.g., "Organic", "Boneless Skinless", "Men's Ankle").
    3. End with the Brand and Size in parentheses.
    4. Remove "Kirkland Signature" if it makes the name too long, or keep it as "Kirkland".
    5. Be concise.

    Input (JSON):
    ${JSON.stringify(items.map(i => ({ id: i.id, original: i.name })))}

    Output must be a strictly valid JSON Array of objects with 'id' and 'newName'. 
    Example: 
    [{"id": 123, "newName": "Milk, Organic Almond, Kirkland (32 oz)"}]
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        // precise json extraction
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) throw new Error("No JSON found in response");

        const updates = JSON.parse(jsonMatch[0]);
        return updates;
    } catch (e) {
        console.error("AI Error:", e);
        return [];
    }
}

async function main() {
    console.log("🚀 Starting AI Renaming...");

    // 1. Fetch Items
    const { data: items, error } = await supabase
        .from('items')
        .select('id, name')
        .gt('id', 729)
        .order('id');

    if (error) { console.error("DB Error:", error); return; }

    console.log(`Found ${items.length} items to process.`);

    // 2. Process in Batches
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        console.log(`Processing batch ${i / BATCH_SIZE + 1} (${batch.length} items)...`);

        const updates = await processBatch(batch);

        // 3. Update Database
        for (const update of updates) {
            const { error: updateError } = await supabase
                .from('items')
                .update({ name: update.newName })
                .eq('id', update.id);

            if (updateError) console.error(`Failed update ID ${update.id}:`, updateError.message);
            else console.log(`✅ ${update.newName}`);
        }

        // Small delay to be nice to API
        await new Promise(r => setTimeout(r, 1000));
    }

    console.log("✨ Done!");
}

main();
