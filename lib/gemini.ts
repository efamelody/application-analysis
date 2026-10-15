import { GoogleGenerativeAI } from "@google/generative-ai";

const DEFAULT_MODEL = "gemini-2.5-flash-lite";

export function getModelName(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

function getClient(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing GEMINI_API_KEY");
  return new GoogleGenerativeAI(key);
}

export function stripCodeFences(text: string): string {
  return text.replace(/```json|```/g, "").trim();
}

export async function generateText(prompt: string): Promise<string> {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({ model: getModelName() });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

export async function generateJson<T>(prompt: string): Promise<T> {
  const text = await generateText(prompt);
  return JSON.parse(stripCodeFences(text)) as T;
}
