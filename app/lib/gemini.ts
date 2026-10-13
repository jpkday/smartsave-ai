import { GoogleGenerativeAI } from "@google/generative-ai";

// Text-only Gemini call that returns parsed JSON. Falls through the models in order,
// and gives the list a second pass after a short pause when they're all overloaded
// (503 "high demand" spikes are usually brief).
const CANDIDATE_MODELS = [
  "gemini-2.5-flash",
  "gemini-3.5-flash",
  "gemini-3.8-flash",
  "gemini-flash-latest",
  "gemini-3.5-flash-lite",
];
const RETRY_DELAY_MS = 2000;
// An overloaded model can hang for minutes; give up on it and try the next one
const REQUEST_TIMEOUT_MS = 30000;

export async function generateJson<T>(prompt: string): Promise<T> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY");

  const genAI = new GoogleGenerativeAI(apiKey.trim());
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0)
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    for (const modelName of CANDIDATE_MODELS) {
      try {
        const model = genAI.getGenerativeModel(
          {
            model: modelName,
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.2,
            },
          },
          { timeout: REQUEST_TIMEOUT_MS },
        );
        const result = await model.generateContent(prompt);
        const text = result.response
          .text()
          .replace(/^```(?:json)?\s*|\s*```$/g, "");
        return JSON.parse(text) as T;
      } catch (err) {
        console.error(
          `Gemini ${modelName} failed:`,
          err instanceof Error ? err.message : err,
        );
        lastError = err;
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("All Gemini models failed");
}
