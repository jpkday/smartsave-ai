import { GoogleGenerativeAI } from '@google/generative-ai';

// Text-only Gemini call that returns parsed JSON. Tries the same model order as
// receipt analysis so a rate-limited or retired model falls through to the next.
const CANDIDATE_MODELS = ['gemini-2.5-flash', 'gemini-3-flash-preview', 'gemini-2.5-pro'];

export async function generateJson<T>(prompt: string): Promise<T> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) throw new Error('Missing GOOGLE_GENERATIVE_AI_API_KEY');

  const genAI = new GoogleGenerativeAI(apiKey.trim());
  let lastError: unknown = null;

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      });
      const result = await model.generateContent(prompt);
      const text = result.response.text().replace(/^```(?:json)?\s*|\s*```$/g, '');
      return JSON.parse(text) as T;
    } catch (err) {
      console.error(`Gemini ${modelName} failed:`, err);
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('All Gemini models failed');
}
