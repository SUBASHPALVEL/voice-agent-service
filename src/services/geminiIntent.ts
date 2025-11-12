import dotenv from "dotenv";
dotenv.config();

import { GoogleGenAI } from "@google/genai";
import { Intent } from "../agents/types";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_ID = "gemini-2.5-flash";
const TEMPERATURE = 0;

const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

const SYSTEM_INSTRUCTION =
  [
    "You classify customer utterances for Melbourne Athletic Development.",
    "Return a single JSON object with exactly one field:",
    `- intent: must be either "booking" or "general_enquiry"`,
    "Never invent new labels or additional properties.",
    "Prefer 'booking' for scheduling, rescheduling, or availability requests; otherwise use 'general_enquiry'.",
  ].join(" ");

export interface GeminiIntentClassification {
  intent: Intent;
}

export async function classifyIntentWithGemini(
  utterance: string
): Promise<GeminiIntentClassification | null> {
  if (!ai) {
    console.warn("Skipping Gemini intent classification: missing GEMINI_API_KEY.");
    return null;
  }

  const trimmed = utterance.trim();
  if (!trimmed) return null;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: [
        {
          role: "user",
          parts: [{ text: `Classify this message:\n${trimmed}` }],
        },
      ],
      config: {
        temperature: TEMPERATURE,
        responseMimeType: "application/json",
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    });

    const text = response.text;
    if (!text) return null;

    return parseResponse(text);
  } catch (error) {
    console.warn("Gemini intent classification failed:", error);
    return null;
  }
}

function parseResponse(raw: string): GeminiIntentClassification | null {
  const cleaned = raw.replace(/```(?:json)?|```/gi, "").trim();
  try {
    const payload = JSON.parse(cleaned);
    const intent = payload.intent;
    if (intent !== "booking" && intent !== "general_enquiry") {
      console.warn(
        "Gemini intent classification returned invalid intent:",
        payload.intent
      );
      return null;
    }

    return { intent };
  } catch {
    console.warn("Gemini intent classification returned non-JSON:", raw);
    return null;
  }
}
