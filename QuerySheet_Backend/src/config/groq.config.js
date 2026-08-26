import Groq from "groq-sdk";

import env from "./env.config.js";

export const groqClient = env.GROQ_API_KEY
  ? new Groq({ apiKey: env.GROQ_API_KEY })
  : null;

// Llama 4 Scout — 30K TPM (vs 12K on 70b-versatile) and 500K TPD (vs 100K).
// TPM is the real bottleneck for large analysis prompts, not RPM, so this
// model gives ~2.5× more throughput on the free tier.
export const GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

// Generation defaults — kept compatible with how we configured Gemini.
// max_tokens for insights lowered to 4096: five insights at ≤500 chars each
// plus chart/summary fits comfortably under 3K output tokens, so 8192 was
// burning TPM headroom that is better saved for concurrent requests.
export const GROQ_INSIGHTS_OPTIONS = {
  temperature: 0.3,
  max_tokens: 4096,
  response_format: { type: "json_object" },
};

export const GROQ_CHAT_OPTIONS = {
  temperature: 0.4,
  max_tokens: 2048,
};

export const isGroqEnabled = () => Boolean(groqClient);
