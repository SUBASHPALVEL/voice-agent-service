import dotenv from "dotenv";
dotenv.config();

import express from "express";
import http from "http";
import WebSocket from "ws";
import {
  startDeepgramStream,
  synthesizeStream,
} from "./services/deepgramStream";
import { geminiStream } from "./services/geminiStream";
import { mainAgent } from "./agents/mainAgent";
import { CallSession } from "./session/callSession";
import { extractLeadInfo } from "./utils/leadCapture";
import { Intent } from "./agents/types";

const app = express();
app.use(express.static("public"));
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("Client connected");
  const session = new CallSession();
  sendJson(ws, { type: "session_started", sessionId: session.id });

  let processingChain = Promise.resolve();

  const deepgramSocket = startDeepgramStream(async (transcript: string) => {
    processingChain = processingChain
      .then(() => handleUserText(transcript, ws, session))
      .catch((err) => console.error("Handler error", err));
    await processingChain;
  });

  const bufferedAudio: Buffer[] = [];

  ws.on("message", (msg: WebSocket.RawData) => {
    const chunk = toBuffer(msg);
    if (!chunk) return;

    if (deepgramSocket.readyState === WebSocket.OPEN) {
      while (bufferedAudio.length > 0) {
        const buffered = bufferedAudio.shift();
        if (buffered) deepgramSocket.send(buffered);
      }
      deepgramSocket.send(chunk);
    } else {
      bufferedAudio.push(chunk);
      console.log("Deepgram not ready, buffering audio chunk...");
    }
  });

  ws.on("close", () => {
    deepgramSocket.close();
    console.log("Client disconnected");
  });
});

async function handleUserText(text: string, ws: WebSocket, session: CallSession) {
  const cleanText = text.trim();
  if (!cleanText) return;

  console.log("User said:", cleanText);
  session.addTurn("user", cleanText);
  const leadUpdated = await extractLeadInfo(cleanText, session.lead);

  sendJson(ws, {
    type: "transcript",
    role: "user",
    text: cleanText,
    sessionId: session.id,
    lead: leadUpdated ? session.lead : undefined,
  });

  try {
    const intent = await mainAgent.classifyIntent(cleanText);
    const agent = mainAgent.route(intent);
    sendJson(ws, { type: "intent", intent, agent: agent.name });

    const prompt = await agent.buildPrompt({
      session,
      latestUserText: cleanText,
      intent,
    });

    await streamAgentResponse(prompt, ws, session, intent);
  } catch (err: any) {
    console.error("Error during text handling:", err.message || err);
    sendJson(ws, {
      type: "error",
      message: "I hit a snag responding. Mind trying that once more?",
    });
  }
}

async function streamAgentResponse(
  prompt: string,
  ws: WebSocket,
  session: CallSession,
  intent: Intent
) {
  console.log("Generating Gemini response via", intent);
  let aggregated = "";
  let received = false;

  try {
    for await (const partial of geminiStream(prompt)) {
      if (!partial || !partial.trim()) continue;
      received = true;
      aggregated += partial;
      sendJson(ws, { type: "agent_text", text: aggregated });

      for await (const audioChunk of synthesizeStream(partial)) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(audioChunk, { binary: true });
        } else {
          break;
        }
      }
    }
  } catch (err) {
    await handleGeminiFailure(ws, session, err);
    return;
  }

  if (!received) {
    console.warn("Gemini returned no text output.");
    sendJson(ws, {
      type: "agent_text",
      text: "Still with you - let me rephrase that in a second.",
    });
    return;
  }

  const finalText = aggregated.trim();
  session.addTurn("agent", finalText);
  sendJson(ws, {
    type: "agent_complete",
    text: finalText,
    lead: session.lead,
  });
}

async function handleGeminiFailure(
  ws: WebSocket,
  session: CallSession,
  error: unknown
) {
  console.error("Gemini streaming failed:", error);
  const fallback =
    "I'm reconnecting to our assistant. Could you please repeat that while I reset?";

  sendJson(ws, { type: "agent_text", text: fallback });

  try {
    for await (const chunk of synthesizeStream(fallback)) {
      if (ws.readyState !== WebSocket.OPEN) break;
      ws.send(chunk, { binary: true });
    }
  } catch (ttsError) {
    console.error("Fallback TTS failed:", ttsError);
  }

  session.addTurn("agent", fallback);
  sendJson(ws, {
    type: "agent_complete",
    text: fallback,
    lead: session.lead,
  });
}

function sendJson(ws: WebSocket, payload: Record<string, unknown>) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function toBuffer(data: WebSocket.RawData): Buffer | undefined {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (Array.isArray(data)) {
    return Buffer.concat(
      data.map((item) => (Buffer.isBuffer(item) ? item : Buffer.alloc(0)))
    );
  }
  return undefined;
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Voice agent running on :${PORT}`);
});

