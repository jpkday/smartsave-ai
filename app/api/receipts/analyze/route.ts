import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { image } = await req.json();

        if (!image) {
            return NextResponse.json({ error: "No image provided" }, { status: 400 });
        }

        const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

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
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Remove header from base64 string if present (data:image/jpeg;base64,...)
        const base64Data = image.split(",")[1] || image;

        const prompt = `
      Analyze this receipt image and extract the following information in strict JSON format:
      1. Store Name (store)
      2. Date of purchase (date) in YYYY-MM-DD format
      3. A list of items (items), where each item has:
         - name: The product name (fix abbreviations if obvious, e.g., 'HVY CRM' -> 'Heavy Cream')
         - price: The unit price (number)
         - quantity: The quantity (number, default to 1)
         - sku: The SKU or product code if visible (string, optional)

      Ignore tax lines, subtotals, and savings summary. Focus on the actual line items.
      
      Output JSON format:
      {
        "store": "Store Name",
        "date": "YYYY-MM-DD",
        "items": [
          { "name": "Item Name", "price": 2.99, "quantity": 1, "sku": "12345" }
        ]
      }
    `;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Data,
                    mimeType: "image/jpeg", // Assuming JPEG for simplicity, usually fine for canvas/upload
                },
            },
        ]);

        const response = await result.response;
        const text = response.text();

        console.log("Gemini Raw Response:", text);

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
