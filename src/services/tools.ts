import { LeadInfo } from "../session/callSession";
import { SlotPreference } from "../utils/leadCapture";
import { BOOKING_CONFIG } from "../config";

interface AvailabilityResult {
  available: boolean;
  slot: string;
  suggestion?: string;
}

const mockCalendar: Record<string, string[]> = {};
const SLOT_TEMPLATES = BOOKING_CONFIG.SLOT_TEMPLATES;

export async function checkAvailability(
  preference?: SlotPreference
): Promise<AvailabilityResult> {
  const date = resolveDate(preference?.date);
  const time = preference?.time ?? "09:00";
  const slot = `${date}T${time}`;

  const busySlots = mockCalendar[date] ?? ["09:00", "12:00"]; // default busy slots
  const available = !busySlots.includes(time);

  if (available) {
    return { available, slot };
  }

  const suggestion =
    findNextOpenSlot(date) ?? `${date}T${suggestFallback(time)}`;

  return { available, slot, suggestion };
}

export async function bookAppointment({
  slot,
  lead,
}: {
  slot: string;
  lead: LeadInfo;
}): Promise<{ confirmation: string; slot: string }> {
  const date = slot.slice(0, 10);
  const time = slot.slice(11);
  mockCalendar[date] = [...new Set([...(mockCalendar[date] ?? []), time])];

  const confirmation = `MAD-${date.replace(/-/g, "")}-${Math.floor(
    Math.random() * 900 + 100
  )}`;

  console.log("Booked slot", { slot, lead, confirmation });

  return { confirmation, slot };
}

function resolveDate(raw?: string): string {
  const base = new Date();
  if (!raw) return formatDate(base);

  const lower = raw.toLowerCase();
  if (lower === "today") return formatDate(base);
  if (lower === "tomorrow") {
    base.setDate(base.getDate() + 1);
    return formatDate(base);
  }

  const weekdays = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];

  const weekdayIndex = weekdays.indexOf(lower.replace("next ", ""));
  if (weekdayIndex >= 0) {
    const current = base.getDay();
    let diff = weekdayIndex - current;
    if (diff <= 0) diff += 7;
    if (lower.startsWith("next ")) diff += 7;
    base.setDate(base.getDate() + diff);
    return formatDate(base);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(lower)) return lower;

  return formatDate(base);
}

function findNextOpenSlot(date: string): string | undefined {
  for (let offset = 0; offset < 5; offset++) {
    const day = shiftDate(date, offset);
    const busy = mockCalendar[day] ?? [];
    const open = SLOT_TEMPLATES.find((slot) => !busy.includes(slot));
    if (open) return `${day}T${open}`;
  }
  return undefined;
}

function suggestFallback(current: string): string {
  const idx = SLOT_TEMPLATES.indexOf(current);
  if (idx >= 0 && SLOT_TEMPLATES[idx + 1]) return SLOT_TEMPLATES[idx + 1];
  return SLOT_TEMPLATES[0];
}

function shiftDate(date: string, offset: number): string {
  const base = new Date(date);
  base.setDate(base.getDate() + offset);
  return formatDate(base);
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

