import { LeadInfo } from "../session/callSession";
import {
  extractLeadEntities,
  GeminiLeadCaptureResult,
} from "../services/geminiLeadCapture";
import { SlotPreference } from "../types/leadCapture";

export type { SlotPreference } from "../types/leadCapture";

let lastExtraction:
  | {
      text: string;
      result: GeminiLeadCaptureResult | null;
    }
  | undefined;

export async function extractLeadInfo(
  text: string,
  lead: LeadInfo
): Promise<boolean> {
  const normalized = text.trim();
  if (!normalized) return false;

  const extraction = await getExtraction(normalized);
  let updated = false;

  const extractedLead = extraction?.lead ?? {};

  updated ||= assignIfPresent(lead, "name", extractedLead.name);
  updated ||= assignIfPresent(lead, "dob", extractedLead.dob);
  updated ||= assignIfPresent(lead, "email", extractedLead.email);
  updated ||= assignIfPresent(lead, "phone", extractedLead.phone);

  if (extractedLead.request) {
    updated ||= assignIfPresent(lead, "request", extractedLead.request);
  } else if (!lead.request || normalized.length > (lead.request?.length ?? 0)) {
    lead.request = normalized;
    updated = true;
  }

  return updated;
}

export async function parsePreferredSlot(
  text: string
): Promise<SlotPreference | undefined> {
  const normalized = text.trim();
  if (!normalized) return undefined;

  const extraction = await getExtraction(normalized);
  return extraction?.slotPreference;
}

async function getExtraction(
  text: string
): Promise<GeminiLeadCaptureResult | null> {
  if (lastExtraction && lastExtraction.text === text) {
    return lastExtraction.result;
  }

  const result = await extractLeadEntities(text);
  lastExtraction = { text, result };
  return result;
}

function assignIfPresent<K extends keyof LeadInfo>(
  lead: LeadInfo,
  field: K,
  value?: LeadInfo[K]
): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  const trimmed = value.trim();
  if (lead[field] === trimmed) return false;
  lead[field] = trimmed as LeadInfo[K];
  return true;
}
