import rateLimit, { ipKeyGenerator } from "express-rate-limit";

import { sendError } from "../utils/response.util.js";

export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => sendError(res, 429, "Too many requests"),
});

export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => req.user?.uid || ipKeyGenerator(req, res),
  handler: (_req, res) =>
    sendError(res, 429, "AI rate limit reached. Max 10 requests per minute."),
});

// Tighter per-user limit specifically for chat — Gemini free tier is 15 RPM
// shared across the whole app, so we keep individual users from monopolising it.
export const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => req.user?.uid || ipKeyGenerator(req, res),
  handler: (_req, res) =>
    sendError(
      res,
      429,
      "Chat rate limit reached (5/min). Please wait a moment before sending another message.",
    ),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => sendError(res, 429, "Too many auth attempts"),
});

export const globalLimiter = globalRateLimiter;
export default globalRateLimiter;
