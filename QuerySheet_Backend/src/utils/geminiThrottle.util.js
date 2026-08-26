import { createHash } from "crypto";

import logger from "./logger.util.js";

/**
 * In-process safeguards against Gemini free-tier rate limits.
 *
 * 1. RPM gate: tracks recent Gemini call timestamps and rejects new calls
 *    fast (without round-tripping to Google) once we approach the free-tier
 *    15 requests-per-minute ceiling.
 *
 * 2. Q&A response cache: short-lived in-memory cache (5 min TTL) keyed by
 *    user + analysis + normalised question. Repeat questions during dev /
 *    quick retries return instantly without burning quota.
 *
 * Both are process-local; on horizontal scale-out you'd swap the Map for
 * Redis. For the current single-process Render deployment this is fine.
 */

// ---- 1. Global RPM gate ---------------------------------------------------

const RPM_LIMIT = 12; // leave 3 RPM headroom under the 15 RPM free-tier cap
const RPM_WINDOW_MS = 60 * 1000;
const callTimestamps = [];

const pruneOldCalls = (now) => {
  while (callTimestamps.length > 0 && now - callTimestamps[0] > RPM_WINDOW_MS) {
    callTimestamps.shift();
  }
};

/**
 * Reserve a Gemini call slot. Throws a 429-coded error if we are at the
 * RPM ceiling so callers can fail fast before hitting Google's quota.
 */
export const reserveGeminiSlot = (requestId) => {
  const now = Date.now();
  pruneOldCalls(now);

  if (callTimestamps.length >= RPM_LIMIT) {
    const oldest = callTimestamps[0];
    const retryAfterMs = Math.max(0, RPM_WINDOW_MS - (now - oldest));
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);

    logger.warn("Local Gemini RPM gate engaged; rejecting fast", {
      requestId,
      currentRpm: callTimestamps.length,
      limit: RPM_LIMIT,
      retryAfterSec,
    });

    const error = new Error(
      `AI service is busy (local RPM cap hit). Try again in ~${retryAfterSec}s.`,
    );
    error.code = "GEMINI_LOCAL_RPM_GATE";
    error.statusCode = 429;
    error.retryAfterSec = retryAfterSec;
    throw error;
  }

  callTimestamps.push(now);
};

// ---- 2. Q&A response cache ------------------------------------------------

const QA_TTL_MS = 5 * 60 * 1000;
const QA_MAX_ENTRIES = 500;
const qaCache = new Map(); // key -> { answer, expiresAt }

const normaliseQuestion = (question) =>
  question
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[?.!,;:]+$/g, "")
    .trim();

const buildQaKey = (uid, analysisId, question) => {
  const normalised = normaliseQuestion(question);
  const hash = createHash("md5")
    .update(`${uid}|${analysisId}|${normalised}`)
    .digest("hex");
  return hash;
};

const evictExpired = (now) => {
  if (qaCache.size < QA_MAX_ENTRIES) return;
  for (const [key, entry] of qaCache) {
    if (entry.expiresAt <= now) qaCache.delete(key);
  }
  // If still over, drop oldest insertions (Map preserves insertion order)
  while (qaCache.size >= QA_MAX_ENTRIES) {
    const firstKey = qaCache.keys().next().value;
    if (!firstKey) break;
    qaCache.delete(firstKey);
  }
};

export const getCachedChatAnswer = (uid, analysisId, question) => {
  const key = buildQaKey(uid, analysisId, question);
  const entry = qaCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    qaCache.delete(key);
    return null;
  }
  return entry.answer;
};

export const setCachedChatAnswer = (uid, analysisId, question, answer) => {
  const now = Date.now();
  evictExpired(now);
  const key = buildQaKey(uid, analysisId, question);
  qaCache.set(key, {
    answer,
    expiresAt: now + QA_TTL_MS,
  });
};

export const _resetForTests = () => {
  callTimestamps.length = 0;
  qaCache.clear();
};
