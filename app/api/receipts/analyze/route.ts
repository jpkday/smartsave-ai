import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
    try {
        const { image } = await req.json();

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

        const prompt = `
      Analyze this receipt image and extract the following information in strict JSON format:
      1. Store Name (store)
      2. Date of purchase (date) in YYYY-MM-DD format
      3. Time of purchase (time) in HH:MM format (24-hour). If not found, use "12:00".
      4. A list of items (items), where each item has:
         - name: The product name (fix abbreviations if obvious, e.g., 'HVY CRM' -> 'Heavy Cream')
         - price: The unit price (number)
         - quantity: The quantity (number, default to 1)
         - sku: The SKU or product code if visible (string, optional)

      Ignore tax lines, subtotals, and savings summary. Focus on the actual line items.
      
      Output JSON format:
      {
        "store": "Store Name",
        "date": "YYYY-MM-DD",
        "time": "HH:MM",
        "items": [
          { "name": "Item Name", "price": 2.99, "quantity": 1, "sku": "12345" }
        ]
      }
    `;

        // Candidate models to try in order (preferring faster/cheaper models first)
        const candidateModels = [
            "gemini-3-flash-preview",  // Newest Flash (2026)
            "gemini-2.5-flash",        // Stable Flash
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

        try {
            const data = JSON.parse(cleanedText);
            return NextResponse.json(data);
        } catch (parseError) {
            console.error("JSON Parse Error:", parseError, "Text:", text);
            return NextResponse.json({ error: "Failed to parse receipt data", raw: text }, { status: 500 });
        }

    } catch (error: any) {
        console.error("Gemini API Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to analyze receipt" },
            { status: 500 }
        );
    }
}
