import { businessSummary, listServices, searchKnowledgeBase } from "../utils/knowledgeBase";
import { Agent } from "./types";

export const enquiryAgent: Agent = {
  name: "enquiry_agent",
  description: "Handles general business information and FAQs.",
  async buildPrompt({ session, latestUserText }) {
    const kbHit = searchKnowledgeBase(latestUserText);

    const context = session.recentConversation
      .slice(-6)
      .map((turn) => `${turn.role === "user" ? "Caller" : "Agent"}: ${turn.text}`)
      .join("\n");

    return `
You are the General Enquiry Specialist for Melbourne Athletic Development.
Brand summary: ${businessSummary()}
Services: ${listServices()}
Knowledge base hit: ${kbHit ?? "None. Use best effort from summary/services above."}
Lead info so far: ${session.formatLeadSummary()}

Conversation so far:
${context}

Caller just asked: "${latestUserText}"

Respond in one or two crisp sentences:
- Provide accurate information from the knowledge base when available.
- Invite the caller to share their goal so you can route them to booking if needed.
- Continue collecting missing lead fields naturally.
`;
  },
};
