import WebSocket from "ws";
import axios from "axios";
import { DEEPGRAM_CONFIG } from "../config";

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY!;
if (!DEEPGRAM_API_KEY) {
  throw new Error("Missing DEEPGRAM_API_KEY in environment variables.");
}

/**
 * Start a live Deepgram transcription stream.
 * Streams mic audio -> Deepgram -> passes transcripts to callback.
 */
export function startDeepgramStream(onTranscript: (text: string) => void) {
  const dg = new WebSocket(DEEPGRAM_CONFIG.LISTEN_URL, {
    headers: {
      Authorization: `Token ${DEEPGRAM_API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  dg.on("open", () => console.log("Connected to Deepgram STT stream"));
  dg.on("close", () => console.log("Deepgram STT connection closed"));
  dg.on("error", (err) =>
    console.error("Deepgram STT connection error:", err.message)
  );

  dg.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      const transcript = data?.channel?.alternatives?.[0]?.transcript;
      if (transcript && transcript.trim().length > 0) {
        console.log("Heard:", transcript);
        onTranscript(transcript);
      }
    } catch (e) {
      console.error("Failed to parse Deepgram message", e);
    }
  });

  return dg;
}

/**
 * Convert text response -> PCM audio via Deepgram REST TTS.
 * Implemented as async generator for compatibility with streaming callers.
 */
export async function* synthesizeStream(
  textChunk: string
): AsyncGenerator<Buffer> {
  if (!textChunk?.trim()) return;

  try {
    const response = await axios.post(
      DEEPGRAM_CONFIG.TTS_URL,
      { text: textChunk },
      {
        responseType: "arraybuffer",
        headers: {
          Authorization: `Token ${DEEPGRAM_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    yield Buffer.from(response.data);
  } catch (err) {
    console.error("Deepgram TTS request failed:", err);
  }
}
