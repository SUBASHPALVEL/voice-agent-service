import { CallSession } from "../session/callSession";

export type Intent = "booking" | "general_enquiry";

export interface AgentContext {
  session: CallSession;
  latestUserText: string;
  intent: Intent;
}

export interface Agent {
  name: string;
  description: string;
  buildPrompt(context: AgentContext): Promise<string>;
}
