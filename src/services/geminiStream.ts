import dotenv from "dotenv";
dotenv.config();
import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY in environment.");

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const MODEL_ID = "gemini-2.5-flash";
const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 503]);

export async function* geminiStream(prompt: string): AsyncGenerator<string> {
  const response = await createStreamWithRetry(prompt);

  for await (const chunk of response) {
    if (chunk.text) {
      yield chunk.text;
    }
  }
}

async function createStreamWithRetry(prompt: string) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await ai.models.generateContentStream({
        model: MODEL_ID,
        config: {
          thinkingConfig: { thinkingBudget: -1 },
          tools: [{ googleSearch: {} }],
        },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
    } catch (error) {
      lastError = error;
      const shouldRetry = isRetryableError(error);

      if (!shouldRetry || attempt === MAX_ATTEMPTS) {
        throw error;
      }

      const backoffMs = attempt * 400;
      console.warn(
        `Gemini stream failed (attempt ${attempt}/${MAX_ATTEMPTS}), retrying in ${backoffMs}ms`
      );
      await sleep(backoffMs);
    }
  }

  throw lastError ?? new Error("Gemini stream failed");
}

function isRetryableError(error: unknown): boolean {
  const code = extractErrorCode(error);
  return !!code && RETRYABLE_STATUS_CODES.has(code);
}

function extractErrorCode(error: unknown): number | undefined {
  const candidate =
    (error as any)?.error?.code ??
    (error as any)?.code ??
    (error as any)?.statusCode;

  if (typeof candidate === "number") return candidate;
  if (typeof candidate === "string") {
    const parsed = Number(candidate);
    if (!Number.isNaN(parsed)) return parsed;
  }

  const message =
    (error as any)?.error?.message ?? (error as any)?.message ?? "";

  if (typeof message === "string") {
    const match = message.match(/"code"\s*:\s*(\d{3})/);
    if (match) {
      const parsed = Number(match[1]);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }

  return undefined;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
