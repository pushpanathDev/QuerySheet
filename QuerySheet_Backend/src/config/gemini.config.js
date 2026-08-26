import { GoogleGenerativeAI } from "@google/generative-ai";

import env from "./env.config.js";

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
export const genAIClient = genAI;

// Used for /analyze — strict JSON output is required.
export const geminiFlash = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  generationConfig: {
    responseMimeType: "application/json",
    temperature: 0.3,
    maxOutputTokens: 8192,
  },
});

// Used for /chat — plain text replies, no JSON wrapping.
export const geminiFlashChat = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  generationConfig: {
    responseMimeType: "text/plain",
    temperature: 0.4,
    maxOutputTokens: 2048,
  },
});
