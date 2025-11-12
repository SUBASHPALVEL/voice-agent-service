import { checkAvailability } from "../services/tools";
import { parsePreferredSlot } from "../utils/leadCapture";
import { listServices } from "../utils/knowledgeBase";
import { Agent } from "./types";

export const bookingAgent: Agent = {
  name: "booking_agent",
  description: "Handles appointment requests, availability checks, and lead capture.",
  async buildPrompt({ session, latestUserText }) {
    const slotPreference = await parsePreferredSlot(latestUserText);
    const availability = await checkAvailability(slotPreference);

    const recent = session.recentConversation
      .slice(-6)
      .map((turn) => `${turn.role === "user" ? "Caller" : "Agent"}: ${turn.text}`)
      .join("\n");

    const slotSummary = slotPreference
      ? `${slotPreference.date ?? "unspecified date"} at ${slotPreference.time ?? "unspecified time"}`
      : "not clearly specified";

    const availabilitySummary = availability.available
      ? `Slot ${availability.slot} is currently OPEN.`
      : `Slot ${availability.slot} is busy. Offer ${availability.suggestion ?? "another time"} instead.`;

    return `
You are the Booking Specialist for Melbourne Athletic Development.
Lead info on file: ${session.formatLeadSummary()}
Requested slot: ${slotSummary}
Availability check: ${availabilitySummary}
Services you can schedule: ${listServices()}

Conversation context:
${recent}

Caller just said: "${latestUserText}"

Tasks:
1. Clarify which service they need and confirm the preferred date/time.
2. Collect any missing lead details (name, DOB, email, phone) conversationally.
3. If availability is open, confirm the slot and ask for permission to book. If busy, offer the suggestion.
4. Keep replies under 2 short sentences for latency. Empathetic, confident tone.
5. Do not repeat questions already asked in this conversation (especially "What are you hoping to achieve with this High Performance Testing?"); build on their previous answers instead.
`;
  },
};
