import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 60; // Increase timeout to 60 seconds

export async function POST(req: NextRequest) {
    try {
        const { image, candidateItems = [], candidateStores = [], shouldAddTrip = true } = await req.json();

        console.log("Analyze Request Received");
        if (image) {
            console.log("Image data length:", image.length);
            console.log("Image start:", image.substring(0, 50));
        }

        if (!image) {
            return NextResponse.json({ error: "No image provided" }, { status: 400 });
        }

        const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

        console.log("Environment Keys:", Object.keys(process.env).filter(k => k.includes('GOOGLE') || k.includes('AI')));
        console.log("API Key found?", !!apiKey);
        if (apiKey) console.log("API Key length:", apiKey.length);

        if (!apiKey) {
            console.error("Missing GOOGLE_GENERATIVE_AI_API_KEY");
            return NextResponse.json(
                { error: "Server configuration error: Missing API Key" },
                { status: 500 }
            );
        }

        // Initialize Gemini
        const genAI = new GoogleGenerativeAI(apiKey.trim());
        console.log("Using API Key length:", apiKey.trim().length);

        // Remove header from base64 string if present (data:image/jpeg;base64,...)
        const match = image.match(/^data:(.+);base64,(.+)$/);
        let mimeType = "image/jpeg";
        let base64Data = image;

        if (match) {
            mimeType = match[1];
            base64Data = match[2];
        } else if (image.includes('base64,')) {
            // Fallback split if regex fails but header exists
            base64Data = image.split(",")[1];
        }

        console.log("Processing image type:", mimeType);

        // Prepare candidate list string (cap at 500 to be safe)
        const knownItemsList = (candidateItems as string[]).slice(0, 500).join(", ");

        // Fetch known SKU mappings to improve matching accuracy
        let skuMappingsSection = "";
        const householdCode = req.headers.get('x-household-code');
        if (householdCode) {
            try {
                const { createClient } = require('@supabase/supabase-js');
                const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
                const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

                if (supabaseUrl && supabaseServiceKey) {
                    const supabase = createClient(supabaseUrl, supabaseServiceKey);

                    // Fetch SKU mappings with store and item names
                    const { data: skuData } = await supabase
                        .from('store_item_sku')
                        .select('store_sku, store_id, stores(name), item_id, items(name)')
                        .limit(500);

                    if (skuData && skuData.length > 0) {
                        // Group by store
                        const byStore: Record<string, string[]> = {};
                        for (const row of skuData) {
                            const storeName = row.stores?.name || 'Unknown';
                            const itemName = row.items?.name || 'Unknown';
                            if (!byStore[storeName]) byStore[storeName] = [];
                            byStore[storeName].push(`${row.store_sku} = "${itemName}"`);
                        }

                        // Build section for prompt
                        const storeEntries = Object.entries(byStore)
                            .map(([store, mappings]) => `${store}:\n${mappings.join('\n')}`)
                            .join('\n\n');

                        skuMappingsSection = `
      KNOWN SKU MAPPINGS (HIGH CONFIDENCE - use these when you see matching SKUs):
      ${storeEntries}
`;
                        console.log(`Loaded ${skuData.length} SKU mappings for improved matching`);
                    }
                }
            } catch (skuErr) {
                console.warn("Failed to load SKU mappings (non-fatal):", skuErr);
            }
        }

        const prompt = `
      Analyze this receipt image and extract information in strict JSON format. 
      
      SPECIAL INSTRUCTIONS FOR NAMING & CONSOLIDATION:
      - **Naming Style**: Format names as 'Primary Category, Specific Type' (e.g., 'Bread, Italian' instead of 'Italian Bread', 'Broth, Unsalted' instead of 'Unsalted Broth').
      - **Units**: If an item is sold per each, use '(ea)' suffix (e.g., 'Parsley (ea)').
      - **Consolidation**: If multiple identical items appear as separate lines on the receipt (e.g., two entries for 'Filled Pasta' at $1.69 each), CONSOLIDATE them into a single JSON object with the combined quantity and the total price.
      
      SPECIAL INSTRUCTIONS FOR ABBREVIATIONS (e.g. Aldi, Lidl):
      - Aggressively expand abbreviations to their full, human-readable names using the Naming Style above.
       - **Text Fidelity**: Trust the text on the receipt. Do not attempt to guess weights or quantities if they are not explicitly printed.
       - If the receipt says 'GROUND BEEF' and the price is $34.97, output 'price': 34.97, 'quantity': 1. Do NOT try to calculate the weight based on market prices.
      - Look specifically for weights (lb, kg, oz) or quantity indicators (e.g. '2 @ 1.50' or '0.45 lb') which may be on the same line or nearby.
      - If an item is sold by weight, capture the weight in the 'quantity' field, and set 'unit' to 'lb' or 'oz'.
      - If a weight is NOT found but the item is clearly a bulk item (e.g. 'GROUND SIRLOIN'), set 'is_weighted' to true.

      EXTRACT THESE FIELDS:
      1. Store Name (store)
      2. Date of purchase (date) in YYYY-MM-DD format
      3. Time of purchase (time) in HH:MM format (24-hour).
      4. A list of items (items), where each item has:
         - name: The product name as seen on receipt (raw string)
         - normalized_name: The expanded name following 'Primary Category, Specific Type' style.
         - price: The UNIT price for one item (number). If multiple identical items are consolidated, this should be the price of a single item.
         - quantity: The numerical quantity or weight (number)
         - unit: The unit of measure, e.g., 'lb', 'oz', 'each', 'bunch', 'bag' (string, default to 'each')
         - is_weighted: true if the item price is determined by weight (boolean)
         - sku: The SKU or product code if visible (string, optional)
         - ai_match: The exact string from the "Known Items" list below that best matches this item.
         - is_discount: true if this line is a coupon, discount, or savings (boolean, default false)
         - related_sku: For coupons, the SKU of the item this discount applies to (string, optional)
         - tax_code: Any tax indicator found next to the price or name (e.g. "A", "T", "*", "F"). (string, optional)

       KNOWN ITEMS LIST: [${knownItemsList}]
       KNOWN STORES LIST: [${(candidateStores as string[]).join(", ")}]
${skuMappingsSection}
       Ignore tax and subtotals. Focus on line items AND coupon/discount lines.

       COUPON/DISCOUNT EXTRACTION (CRITICAL):
       - Extract ALL coupon, discount, and savings lines as separate items
       - For Costco: Coupons appear as lines like "0000372203 / 1257371" followed by a negative price (e.g., "-4.50" or "4.50-")
       - For other stores: Look for "COUPON", "DISCOUNT", "SAVINGS", "MFR CPN", "STORE CPN", or negative prices
       - Set is_discount: true for all coupon/discount lines
       - Set price as a NEGATIVE number for discounts (e.g., -4.50)
       - For Costco coupons with format "XXXXXXX / YYYYYYY", use YYYYYYY as the related_sku (the item this coupon applies to)
       
       TAX FLAGS:
       - Look for "A", "T", "*", or other single-letter codes next to the price or at the end of the item name.
       - Extract this into the 'tax_code' field.

       DATE & TIME GUIDANCE:
       - Date and time are often at the VERY TOP or VERY BOTTOM of the receipt.
       - Look for strings like 'DATE:', 'TIME:', 'CHECK:', or 'ID' followed by a timestamp.
       - Format date as YYYY-MM-DD and time as HH:MM.
      
      Output JSON format:
      {
        "store": "Store Name",
        "date": "YYYY-MM-DD",
        "time": "HH:MM",
        "items": [
          {
            "name": "RAW NAME",
            "normalized_name": "Category, Modifier",
            "price": 2.99,
            "quantity": 1,
            "unit": "lb",
            "is_weighted": true,
            "sku": "12345",
            "ai_match": "Milk",
            "is_discount": false,
            "ai_match": "Milk",
            "is_discount": false,
            "related_sku": null,
            "tax_code": "A"
          },
          {
            "name": "COUPON 0000372203 / 1257371",
            "normalized_name": "Coupon",
            "price": -4.50,
            "quantity": 1,
            "unit": "each",
            "is_weighted": false,
            "sku": "0000372203",
            "ai_match": null,
            "is_discount": true,
            "related_sku": "1257371"
          }
        ]
      }
    `;

        // Candidate models to try in order (preferring faster/cheaper models first)
        const candidateModels = [
            "gemini-2.5-flash",        // Stable Flash (Prioritized due to rate limits)
            "gemini-3-flash-preview",  // Newest Flash (2026)
            "gemini-3-pro-preview",    // Newest Pro
            "gemini-2.5-pro",          // Stable Pro
            "gemini-1.5-flash",        // Legacy Fallback
        ];

        let result = null;
        let lastError = null;
        let usedModel = "";

        for (const modelName of candidateModels) {
            try {
                console.log(`Attempting model: ${modelName}`);
                const model = genAI.getGenerativeModel({ model: modelName });

                result = await model.generateContent([
                    prompt,
                    {
                        inlineData: {
                            data: base64Data,
                            mimeType: mimeType,
                        },
                    },
                ]);

                usedModel = modelName;
                console.log(`SUCCESS: Model ${modelName} worked.`);
                break; // Exit loop on success
            } catch (err: any) {
                console.warn(`FAILED: Model ${modelName} - ${err.message}`);
                lastError = err;
                // Continue to next model
            }
        }

        if (!result) {
            console.error("All models failed.");
            throw lastError || new Error("All Gemini models failed to generate content.");
        }

        const response = await result.response;
        const text = response.text();

        console.log(`Gemini Response (via ${usedModel}):`, text);

        // Clean up markdown code blocks if present
        const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();

        // ... (Generated AI response parsing)

        try {
            const data = JSON.parse(cleanedText);

            // --- NEW: Staging Logic ---
            const { createClient } = require('@supabase/supabase-js');
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

            if (!supabaseUrl || !supabaseServiceKey) {
                // Fallback to direct return if no DB config (shouldn't happen in prod)
                console.warn("Missing Supabase Service Key, returning JSON directly.");
                return NextResponse.json(data);
            }

            const supabase = createClient(supabaseUrl, supabaseServiceKey);

            // 1. Determine Household (Use a header or default for now - context is scarce in simple API)
            const householdCode = req.headers.get('x-household-code');

            if (!householdCode) {
                return NextResponse.json({ error: "Missing x-household-code header" }, { status: 400 });
            }

            // 2. Identify Store
            let storeId = null;
            if (data.store) {
                const { data: stores } = await supabase
                    .from('stores')
                    .select('id, name')
                    .ilike('name', `%${data.store}%`); // Simple fuzzy

                if (stores && stores.length > 0) {
                    storeId = stores[0].id;
                    // Inject identified store matches into response for UI
                    data.store_match = stores[0];
                }
            }

            // 3. Save to Staging
            const { data: inserted, error: dbError } = await supabase
                .from('imported_receipts')
                .insert({
                    household_code: householdCode,
                    store_id: storeId,
                    image_url: base64Data.slice(0, 100) + "...",
                    ocr_data: { ...data, should_add_trip: shouldAddTrip },
                    status: 'pending'
                })
                .select('id')
                .single();

            if (dbError) {
                throw new Error("Database Staging Error: " + dbError.message);
            }

            return NextResponse.json({
                success: true,
                importId: inserted.id,
                message: "Receipt staged for review.",
                ocr_preview: data
            });

        } catch (parseError: any) {
            console.error("Processing Error:", parseError, "Text:", text);
            return NextResponse.json({ error: "Failed to process receipt: " + parseError.message, raw: text }, { status: 500 });
        }
    } catch (error: any) {
        console.error("Gemini API Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to analyze receipt" },
            { status: 500 }
        );
    }
}
