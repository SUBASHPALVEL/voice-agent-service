// src/config.ts

// Gemini API settings
export const GEMINI_CONFIG = {
  MODEL_ID: "gemini-2.5-flash",
  TEMPERATURE: 0,
};

// Deepgram API settings
export const DEEPGRAM_CONFIG = {
  LISTEN_URL: "wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000",
  TTS_URL: "https://api.deepgram.com/v1/speak?model=aura-asteria-en&encoding=linear16&sample_rate=16000",
};

// Booking and availability settings
export const BOOKING_CONFIG = {
  SLOT_TEMPLATES: ["07:30", "09:00", "10:30", "12:00", "15:00", "17:30"],
};

// System prompts
export const PROMPTS = {
  LEAD_CAPTURE_SYSTEM_INSTRUCTION: [
    "You extract structured lead information for Melbourne Athletic Development.",
    "Return strict JSON with exactly the following shape:",
    `{
      "lead": {
        "name": string | null,
        "dob": string | null,
        "email": string | null,
        "phone": string | null,
        "request": string | null
      },
      "slotPreference": {
        "date": string | null,
        "time": string | null,
        "meridiem": "am" | "pm" | null
      }
    }`,
    "If a field is unknown, set it to null. Do not invent extra properties.",
    "Phone numbers MUST be digits only (e.g., '0400111222'), not words ('oh four hundred...').",
    "Dates of birth (DOB) should be in YYYY-MM-DD format.",
    "Times should already be in 24-hour HH:MM where possible.",
  ].join(" "),
};
