import { bookingAgent } from "./bookingAgent";
import { enquiryAgent } from "./enquiryAgent";
import { Agent, Intent } from "./types";
import { classifyIntentWithGemini } from "../services/geminiIntent";

export const mainAgent = {
  async classifyIntent(text: string): Promise<Intent> {
    const normalized = (text ?? "").trim();
    if (!normalized) return "general_enquiry";

    const aiResult = await classifyIntentWithGemini(normalized);
    if (aiResult) {
      return aiResult.intent;
    }

    return "general_enquiry";
  },
  route(intent: Intent): Agent {
    return intent === "booking" ? bookingAgent : enquiryAgent;
  },
};
