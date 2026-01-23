import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
    try {
        const { image, candidateItems = [] } = await req.json();

        if (!image) {
            return NextResponse.json({ error: "No image provided" }, { status: 400 });
        }

        // Get household code from header
        const householdCode = req.headers.get('x-household-code');
        if (!householdCode) {
            return NextResponse.json({ error: "Missing x-household-code header" }, { status: 400 });
        }

        // Initialize Gemini API
        const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!apiKey) {
            console.error("Missing GOOGLE_GENERATIVE_AI_API_KEY");
            return NextResponse.json(
                { error: "Server configuration error: Missing API Key" },
                { status: 500 }
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey.trim());

        // Remove header from base64 string if present (avoiding regex for large strings)
        let mimeType = "image/jpeg";
        let base64Data = image;

        if (image.startsWith('data:')) {
            const commaIndex = image.indexOf(',');
            if (commaIndex !== -1) {
                const header = image.substring(0, commaIndex);
                base64Data = image.substring(commaIndex + 1);

                // Extract mime type from header (e.g., "data:image/jpeg;base64")
                const mimeStart = header.indexOf(':') + 1;
                const mimeEnd = header.indexOf(';');
                if (mimeStart > 0 && mimeEnd > mimeStart) {
                    mimeType = header.substring(mimeStart, mimeEnd);
                }
            }
        }

        console.log("Processing price tag image, type:", mimeType);

        // Prepare candidate list string (cap at 500 to be safe)
        const knownItemsList = (candidateItems as string[]).slice(0, 500).join(", ");

        // Prompt for Gemini to extract price tag data
        const prompt = `
Analyze this store price tag photo and extract the following information.

For Costco tags specifically:
- Item number is the 5-7 digit number at top
- Product name is below item number
- Sale indicators: yellow bar with "Instant Savings" or "Instant Rebate"
- Unit price is shown in a box at bottom left (e.g., "PRICE PER POUND", "PRICE PER QUART")
- Final price is the large number at bottom right

Extract:
- Item number/SKU (if visible)
- Item name (full product name, including brand if shown, e.g., "KIRKLAND SIGNATURE")
- ai_match: The exact string from the "Known Items" list below that best matches this item. If no semantic match exists, return null.
- Final price (the actual price to pay, after any discounts)
- Original price (if on sale, the crossed-out price)
- Discount amount (from yellow sale banner)
- Store name (Costco, Safeway, etc. - may be identified by tag format)
- Unit size (e.g., "5 LBS", "3LB", "6/32 FL OZ", "67.63 FL OZ")
- Store's calculated unit price (from bottom left box, e.g., "$1.098/lb", "$2.465/qt")
- Sale expiration date (from yellow banner, if visible)

KNOWN ITEMS LIST: [${knownItemsList}]

Return ONLY valid JSON in this exact format:
{
  "item_number": "string or null",
  "item_name": "exact product name",
  "ai_match": "matched known item or null",
  "price": 0.00,
  "original_price": 0.00 or null,
  "discount_amount": 0.00 or null,
  "store": "store name or null",
  "unit": "size or null",
  "store_unit_price": "string or null (e.g., '$1.098/lb')",
  "sale_expiration": "YYYY-MM-DD or null",
  "is_sale": true or false,
  "confidence": 0.0-1.0
}
`;


        // Candidate models to try in order (same as receipt scanning)
        const candidateModels = [
            "gemini-3-flash-preview",  // Newest Flash (2026)
            "gemini-2.5-flash",        // Stable Flash
            "gemini-3-pro-preview",    // Newest Pro
            "gemini-2.5-pro",          // Stable Pro
            "gemini-1.5-flash",        // Legacy Fallback
        ];

        let text = "";
        let usedModel = "";
        let lastError = null;

        for (const modelName of candidateModels) {
            try {
                console.log(`Attempting model: ${modelName}`);
                const model = genAI.getGenerativeModel({ model: modelName });

                const generateResult = await model.generateContent([
                    prompt,
                    {
                        inlineData: {
                            data: base64Data,
                            mimeType: mimeType,
                        },
                    },
                ]);

                const response = await generateResult.response;
                text = response.text();

                if (text && text.trim().length > 0) {
                    usedModel = modelName;
                    console.log(`SUCCESS: Model ${modelName} returned valid content.`);
                    break;
                } else {
                    console.warn(`EMPTY: Model ${modelName} returned no text.`);
                }
            } catch (err: any) {
                console.warn(`FAILED: Model ${modelName} - ${err.message}`);
                lastError = err;
            }
        }

        if (!text || text.trim().length === 0) {
            console.error("All models failed or returned empty responses.");
            throw lastError || new Error("Vision API returned empty response. The image may be unreadable or the model encountered an error.");
        }

        console.log(`Gemini Response (via ${usedModel}):`, text);
        console.log('Response length:', text.length);

        // Clean up markdown code blocks if present
        const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();

        console.log('Cleaned text:', cleanedText.substring(0, 200) + '...');

        try {
            const data = JSON.parse(cleanedText);

            // Format unit price to 2 decimal places if present
            if (data.store_unit_price && typeof data.store_unit_price === 'string') {
                // Extract price and unit (e.g., "$8.797/qt" -> ["8.797", "/qt"])
                const match = data.store_unit_price.match(/\$?([\d.]+)(\/.*)?/);
                if (match) {
                    const price = parseFloat(match[1]);
                    const unit = match[2] || '';
                    data.store_unit_price = `$${price.toFixed(2)}${unit}`;
                }
            }

            // Initialize Supabase
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

            if (!supabaseUrl || !supabaseServiceKey) {
                console.warn("Missing Supabase config, returning extracted data only");
                return NextResponse.json({
                    success: true,
                    extracted: data
                });
            }

            const supabase = createClient(supabaseUrl, supabaseServiceKey);

            // Identify store
            let storeId = null;
            let storeMatch = null;
            if (data.store) {
                const { data: stores } = await supabase
                    .from('stores')
                    .select('id, name')
                    .ilike('name', `%${data.store}%`);

                if (stores && stores.length > 0) {
                    storeId = stores[0].id;
                    storeMatch = stores[0];
                }
            }

            // Check for spam (same user/item/store within 1 hour)
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            const { data: recentSubmissions } = await supabase
                .from('price_submissions')
                .select('id')
                .eq('household_code', householdCode)
                .eq('item_name', data.item_name)
                .eq('store_id', storeId)
                .eq('verified', true)
                .gte('created_at', oneHourAgo);

            if (recentSubmissions && recentSubmissions.length > 0) {
                return NextResponse.json(
                    { error: "Looks like you already shared a price for this item! We've got it covered for now. Thanks for helping out! 🛍️" },
                    { status: 429 }
                );
            }

            // Save to price_submissions table
            const { data: inserted, error: dbError } = await supabase
                .from('price_submissions')
                .insert({
                    household_code: householdCode,
                    store_item_number: data.item_number,
                    item_name: data.item_name,
                    price: data.price,
                    original_price: data.original_price,
                    discount_amount: data.discount_amount,
                    store_id: storeId,
                    unit_size: data.unit,
                    store_unit_price: data.store_unit_price,
                    is_sale: data.is_sale || false,
                    sale_expiration: data.sale_expiration,
                    image_url: base64Data.slice(0, 100) + "...", // Truncated for demo
                    confidence_score: data.confidence,
                    verified: false,
                })
                .select('id')
                .single();

            if (dbError) {
                throw new Error("Database Error: " + dbError.message);
            }

            return NextResponse.json({
                success: true,
                submission_id: inserted.id,
                extracted: {
                    ...data,
                    store_match: storeMatch,
                },
                message: "Price tag data extracted and staged for review"
            });

        } catch (parseError: any) {
            console.error("Processing Error:", parseError, "Text:", text);
            return NextResponse.json(
                { error: "Failed to process price tag: " + parseError.message, raw: text },
                { status: 500 }
            );
        }
    } catch (error: any) {
        console.error("Gemini API Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to analyze price tag" },
            { status: 500 }
        );
    }
}
