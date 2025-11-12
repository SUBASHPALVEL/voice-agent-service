import dotenv from "dotenv";
dotenv.config();

import { GoogleGenAI } from "@google/genai";
import { LeadInfo } from "../session/callSession";
import { SlotPreference } from "../types/leadCapture";
import { GEMINI_CONFIG, PROMPTS } from "../config";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

const SYSTEM_INSTRUCTION = PROMPTS.LEAD_CAPTURE_SYSTEM_INSTRUCTION;

export interface GeminiLeadCaptureResult {
  lead: Partial<LeadInfo>;
  slotPreference?: SlotPreference;
}

export async function extractLeadEntities(
  text: string
): Promise<GeminiLeadCaptureResult | null> {
  if (!ai) {
    console.warn("Skipping Gemini lead capture: missing GEMINI_API_KEY.");
    return null;
  }

  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_CONFIG.MODEL_ID,
      contents: [
        {
          role: "user",
          parts: [{ text: `Extract lead info from:\n${trimmed}` }],
        },
      ],
      config: {
        temperature: GEMINI_CONFIG.TEMPERATURE,
        responseMimeType: "application/json",
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    });

    const payload = response.text;
    if (!payload) return null;
    return parseLeadCaptureResponse(payload);
  } catch (error) {
    console.warn("Gemini lead capture failed:", error);
    return null;
  }
}

function parseLeadCaptureResponse(raw: string): GeminiLeadCaptureResult | null {
  const cleaned = raw.replace(/```(?:json)?|```/gi, "").trim();
  if (!cleaned) return null;

  try {
    const data = JSON.parse(cleaned);
    const lead = sanitizeLead(data?.lead);
    const slotPreference = sanitizeSlotPreference(data?.slotPreference);

    if (!lead && !slotPreference) {
      return null;
    }

    return {
      lead: lead ?? {},
      slotPreference: slotPreference ?? undefined,
    };
  } catch (error) {
    console.warn("Gemini lead capture returned non-JSON payload:", raw, error);
    return null;
  }
}

function sanitizeLead(input: any): Partial<LeadInfo> | undefined {
  if (!input || typeof input !== "object") return undefined;

  const sanitized: Partial<LeadInfo> = {};

  if (isNonEmptyString(input.name)) sanitized.name = input.name.trim();
  if (isNonEmptyString(input.dob)) sanitized.dob = input.dob.trim();
  if (isNonEmptyString(input.email)) sanitized.email = input.email.trim();
  const phone = coercePhone(input.phone);
  if (phone) sanitized.phone = phone;
  if (isNonEmptyString(input.request)) sanitized.request = input.request.trim();

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function sanitizeSlotPreference(input: any): SlotPreference | undefined {
  if (!input || typeof input !== "object") return undefined;

  const slot: SlotPreference = {};

  if (isNonEmptyString(input.date)) {
    slot.date = input.date.trim();
  }
  if (isNonEmptyString(input.time)) {
    slot.time = input.time.trim();
  }

  if (isNonEmptyString(input.meridiem)) {
    const meridiem = input.meridiem.trim().toLowerCase();
    if (meridiem === "am" || meridiem === "pm") {
      slot.meridiem = meridiem;
    }
  }

  return Object.keys(slot).length > 0 ? slot : undefined;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function coercePhone(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value).toString();
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return /^\+?\d+$/.test(trimmed) ? trimmed : undefined;
  }

  return undefined;
}
