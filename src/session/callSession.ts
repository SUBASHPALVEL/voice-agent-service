import { randomUUID } from "crypto";

export type ConversationRole = "user" | "agent";

export interface ConversationTurn {
  role: ConversationRole;
  text: string;
  timestamp: number;
}

export interface LeadInfo {
  name?: string;
  dob?: string;
  email?: string;
  phone?: string;
  request?: string;
}

export class CallSession {
  readonly id = randomUUID();
  private turns: ConversationTurn[] = [];
  lead: LeadInfo = {};
  createdAt = Date.now();

  addTurn(role: ConversationRole, text: string) {
    if (!text.trim()) return;
    this.turns.push({ role, text, timestamp: Date.now() });
    if (this.turns.length > 50) {
      this.turns = this.turns.slice(-50); // keep latest for prompts
    }
  }

  get recentConversation(): ConversationTurn[] {
    return [...this.turns];
  }

  latestUserText(): string {
    const last = [...this.turns].reverse().find((turn) => turn.role === "user");
    return last?.text ?? "";
  }

  formatLeadSummary(): string {
    const { name, dob, email, phone, request } = this.lead;
    return [
      `Name: ${name ?? "unknown"}`,
      `DOB: ${dob ?? "unknown"}`,
      `Email: ${email ?? "unknown"}`,
      `Phone: ${phone ?? "unknown"}`,
      `Request: ${request ?? "unspecified"}`,
    ].join(", ");
  }
}
