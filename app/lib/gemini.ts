import { GoogleGenerativeAI } from "@google/generative-ai";

// Text-only Gemini call that returns parsed JSON. Falls through the models in order.
// Only overloaded models (503 "high demand", or a timeout) get a second try after a
// short pause; quota (429) and retired-model (404) errors are not retried. After a
// complete failure the AI is skipped for a few minutes so callers fall back at once
// instead of waiting on every model again.
const CANDIDATE_MODELS = [
  "gemini-2.5-flash",
  "gemini-3.5-flash",
  "gemini-3.8-flash",
  "gemini-flash-latest",
  "gemini-3.5-flash-lite",
];
const RETRY_DELAY_MS = 2000;
// An overloaded model can hang for minutes; give up on it and try the next one
const REQUEST_TIMEOUT_MS = 20000;
const COOL_DOWN_MS = 5 * 60 * 1000;
// Most a caller waits in total across models and retries before giving up
const TOTAL_BUDGET_MS = 30000;

let unavailableUntil = 0;

const isTransient = (err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  return /\[503|overloaded|high demand|timed? ?out|aborted|fetch failed/i.test(message);
};

export async function generateJson<T>(prompt: string): Promise<T> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY");
  if (Date.now() < unavailableUntil) {
    throw new Error("Gemini unavailable (recent failures); skipping for now");
  }

  const genAI = new GoogleGenerativeAI(apiKey.trim());
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  let lastError: unknown = null;
  let models = CANDIDATE_MODELS;

  for (let attempt = 0; attempt < 2 && models.length > 0 && Date.now() < deadline - RETRY_DELAY_MS; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
    const retryable: string[] = [];
    for (const modelName of models) {
      const remaining = deadline - Date.now();
      if (remaining < 1000) break;
      try {
        const model = genAI.getGenerativeModel(
          {
            model: modelName,
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.2,
            },
          },
          { timeout: Math.min(REQUEST_TIMEOUT_MS, remaining) },
        );
        const result = await model.generateContent(prompt);
        const text = result.response
          .text()
          .replace(/^```(?:json)?\s*|\s*```$/g, "");
        return JSON.parse(text) as T;
      } catch (err) {
        console.error(
          `Gemini ${modelName} failed:`,
          err instanceof Error ? err.message.slice(0, 200) : err,
        );
        lastError = err;
        if (isTransient(err)) retryable.push(modelName);
      }
    }
    models = retryable;
  }

  unavailableUntil = Date.now() + COOL_DOWN_MS;
  throw lastError instanceof Error
    ? lastError
    : new Error("All Gemini models failed");
}
