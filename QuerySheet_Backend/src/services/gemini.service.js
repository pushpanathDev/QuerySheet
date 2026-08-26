import { z } from "zod";

import { geminiFlash, geminiFlashChat } from "../config/gemini.config.js";
import { reserveGeminiSlot } from "../utils/geminiThrottle.util.js";
import logger from "../utils/logger.util.js";
import { buildAnalysisPrompt } from "../utils/promptBuilder.util.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const insightSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "trend",
    "anomaly",
    "correlation",
    "distribution",
    "recommendation",
  ]),
  title: z.string().max(80),
  description: z.string().max(500),
  severity: z.enum(["info", "warning", "critical"]),
  relatedColumns: z.array(z.string()),
  sheetName: z.string().optional(),
});

const chartDataSchema = z.object({
  chartType: z.enum(["bar", "line", "pie"]),
  title: z.string(),
  sheetName: z.string().optional(),
  xKey: z.string(),
  yKeys: z.array(z.string()),
});

const summarySchema = z.object({
  keyFindings: z.string(),
  dataQuality: z.enum(["good", "fair", "poor"]),
  recommendedActions: z.array(z.string()),
});

const geminiOutputSchema = z.object({
  insights: z.array(insightSchema).min(1).max(10),
  chartData: z.array(chartDataSchema),
  summary: summarySchema,
});

const callWithRetry = async (
  fn,
  maxRetries = 4,
  requestId,
  { rateLimitCooldownMs = 61000, maxRateLimitRetries = maxRetries } = {},
) => {
  let attempt = 0;
  let rateLimitAttempts = 0;

  while (attempt <= maxRetries) {
    try {
      // Reserve a global RPM slot before each attempt so we never burn
      // Gemini's free-tier quota with calls we know will fail.
      reserveGeminiSlot(requestId);
      return await fn();
    } catch (error) {
      const message = error?.message ?? "";
      const upper = message.toUpperCase();
      const status = error?.status;

      // Local RPM gate — surface immediately, do not retry.
      if (error?.code === "GEMINI_LOCAL_RPM_GATE") {
        throw error;
      }

      // Extract HTTP status from messages like "[503 Service Unavailable]"
      const httpMatch = message.match(/\[(\d{3})\s/);
      const httpStatus = httpMatch ? Number(httpMatch[1]) : null;

      if (upper.includes("INVALID_ARGUMENT") || httpStatus === 400) {
        const invalidPromptError = new Error("Gemini prompt is invalid");
        invalidPromptError.code = "GEMINI_INVALID_PROMPT";
        invalidPromptError.detail = message;
        throw invalidPromptError;
      }

      const isRateLimit =
        upper.includes("RATE_LIMIT_EXCEEDED") ||
        upper.includes("RESOURCE_EXHAUSTED") ||
        status === 429 ||
        httpStatus === 429;

      if (isRateLimit) {
        // Rate-limit retries are bounded separately so user-facing endpoints
        // (chat) can fail fast instead of waiting multiple 61s cooldowns.
        if (rateLimitAttempts >= maxRateLimitRetries) {
          const rateError = new Error(
            "AI service is currently rate limited. Please wait a minute and try again.",
          );
          rateError.code = "GEMINI_RATE_LIMITED";
          rateError.statusCode = 429;
          throw rateError;
        }
        logger.warn("Gemini rate limit reached; retrying after cooldown", {
          requestId,
          attempt,
          maxRetries,
          rateLimitAttempts,
          maxRateLimitRetries,
          cooldownMs: rateLimitCooldownMs,
        });
        rateLimitAttempts += 1;
        attempt += 1;
        if (attempt > maxRetries) {
          break;
        }
        await sleep(rateLimitCooldownMs);
        continue;
      }

      const isTransient =
        upper.includes("INTERNAL") ||
        upper.includes("UNAVAILABLE") ||
        upper.includes("DEADLINE_EXCEEDED") ||
        upper.includes("FETCH FAILED") ||
        httpStatus === 500 ||
        httpStatus === 502 ||
        httpStatus === 503 ||
        httpStatus === 504;

      if (isTransient) {
        // Exponential backoff with jitter: 1s, 2s, 4s, 8s (+ up to 1s jitter)
        const delayMs =
          Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 1000);
        logger.warn("Transient Gemini error; retrying with backoff", {
          requestId,
          attempt,
          maxRetries,
          delayMs,
          httpStatus,
          message,
        });
        attempt += 1;
        if (attempt > maxRetries) {
          break;
        }
        await sleep(delayMs);
        continue;
      }

      throw error;
    }
  }

  const maxRetryError = new Error(
    "Gemini service is temporarily unavailable. Please try again in a moment.",
  );
  maxRetryError.code = "GEMINI_MAX_RETRIES";
  maxRetryError.statusCode = 503;
  maxRetryError.attempts = attempt;
  throw maxRetryError;
};

const parseGeminiJson = (rawText) => {
  try {
    return JSON.parse(rawText);
  } catch {
    // Fallback: manually find the first properly balanced JSON object sequence
    let startIndex = rawText.indexOf("{");
    if (startIndex === -1) return null;

    let openBraces = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = startIndex; i < rawText.length; i++) {
      const char = rawText[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (char === "\\") {
        escapeNext = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === "{") openBraces++;
        if (char === "}") {
          openBraces--;
          if (openBraces === 0) {
            const potentialJsonString = rawText.substring(startIndex, i + 1);
            try {
              return JSON.parse(potentialJsonString);
            } catch {
              // Might be malformed inside the braces; return null to trigger validation failure
              return null;
            }
          }
        }
      }
    }

    return null;
  }
};

const generateInsights = async (
  sheetSummaries,
  datasetName,
  { requestId } = {},
) => {
  const prompt = buildAnalysisPrompt(sheetSummaries, datasetName);

  const result = await callWithRetry(
    () => geminiFlash.generateContent(prompt),
    4,
    requestId,
  );
  const rawText = result.response.text();
  const finishReason = result.response.candidates?.[0]?.finishReason;
  const usage = result.response.usageMetadata;

  if (finishReason && finishReason !== "STOP") {
    logger.error("Gemini generation did not finish cleanly", {
      requestId,
      finishReason,
      usage,
      rawTextLength: rawText.length,
    });
    const truncationError = new Error(
      `Gemini response truncated (finishReason=${finishReason})`,
    );
    truncationError.code = "GEMINI_TRUNCATED";
    throw truncationError;
  }

  return parseAndValidateInsights(rawText, requestId);
};

/**
 * Public helper exported for the cross-provider orchestrator (`llm.service.js`)
 * so we can reuse the same defensive parsing + zod validation regardless of
 * which provider produced the raw text.
 */
const parseAndValidateInsights = (rawText, requestId) => {
  const parsed = parseGeminiJson(rawText);

  if (!parsed) {
    const parseError = new Error("LLM returned non-JSON insights response");
    parseError.code = "LLM_INVALID_OUTPUT";
    logger.error("LLM insights JSON parsing failed", {
      requestId,
      rawText,
    });
    throw parseError;
  }

  // Defensive normalization: LLMs sometimes confuse severity/type enums.
  if (Array.isArray(parsed.insights)) {
    const validSeverities = new Set(["info", "warning", "critical"]);
    const validTypes = new Set([
      "trend",
      "anomaly",
      "correlation",
      "distribution",
      "recommendation",
    ]);
    parsed.insights = parsed.insights.map((insight) => {
      if (!insight) return insight;
      const fixed = { ...insight };

      if (!validSeverities.has(fixed.severity)) {
        logger.warn("Coerced invalid insight severity to 'info'", {
          requestId,
          original: fixed.severity,
          insightId: fixed.id,
        });
        fixed.severity = "info";
      }

      if (!validTypes.has(fixed.type)) {
        logger.warn("Coerced invalid insight type to 'distribution'", {
          requestId,
          original: fixed.type,
          insightId: fixed.id,
        });
        fixed.type = "distribution";
      }

      return fixed;
    });
  }

  const validated = geminiOutputSchema.safeParse(parsed);

  if (!validated.success) {
    const schemaError = new Error("LLM insights failed schema validation");
    schemaError.code = "LLM_INVALID_OUTPUT";
    logger.error("LLM insights validation failed", {
      requestId,
      rawText,
      issues: validated.error.issues,
    });
    throw schemaError;
  }

  return validated.data;
};

/**
 * Raw insights call — used by the cross-provider orchestrator. Returns the
 * unparsed JSON string from Gemini so the orchestrator can fall back to a
 * different provider on transient failures without re-parsing here.
 */
const generateInsightsRaw = async (
  sheetSummaries,
  datasetName,
  { requestId } = {},
) => {
  const prompt = buildAnalysisPrompt(sheetSummaries, datasetName);

  const result = await callWithRetry(
    () => geminiFlash.generateContent(prompt),
    4,
    requestId,
  );
  const rawText = result.response.text();
  const finishReason = result.response.candidates?.[0]?.finishReason;
  const usage = result.response.usageMetadata;

  if (finishReason && finishReason !== "STOP") {
    const truncationError = new Error(
      `Gemini response truncated (finishReason=${finishReason})`,
    );
    truncationError.code = "GEMINI_TRUNCATED";
    truncationError.usage = usage;
    throw truncationError;
  }

  return { rawText, finishReason, usage };
};

const buildChatPrompt = (question, context, conversationHistory) => {
  const recentHistory = conversationHistory.slice(-5);
  const isMultiSheet =
    Array.isArray(context?.sheets) && context.sheets.length > 0;

  const systemInstructions = [
    "You are a senior business analytics assistant for QuerySheet.",
    "",
    "RESPONSE RULES (strictly follow):",
    "1. Be CONCISE. Keep answers under 300 words unless the user explicitly asks for a deep dive.",
    "2. NEVER dump raw column statistics as a list. Instead, synthesize them into brief insights — highlight only what is interesting, unusual, or actionable.",
    "3. When explaining statistics, group columns by theme (e.g. financial metrics, customer demographics) and summarize patterns rather than listing each column individually.",
    "4. Use markdown formatting: bold for key figures, bullet points for findings, and headers (##) to separate sections when covering multiple topics.",
    "5. If the user asks about a SPECIFIC column or metric, give a focused answer about that column only.",
    "6. Prioritize: anomalies > trends > correlations > distributions > raw descriptions.",
    "7. When numbers are large, use human-readable formats (e.g. '~132K' instead of '132478.74').",
    "8. End with a brief actionable suggestion or a follow-up question the user might want to explore.",
  ].join("\n");

  const sheetInstructions = isMultiSheet
    ? "The dataset contains MULTIPLE sheets (tabs). Each sheet has its own columns and statistics. When answering: identify which sheet(s) are relevant, cite sheet names explicitly, and cross-reference sheets when useful. If the question is ambiguous, briefly cover all sheets."
    : "The dataset has a single table.";

  const compressedContext = compressChatContext(context);

  return [
    systemInstructions,
    sheetInstructions,
    `Dataset context:\n${JSON.stringify(compressedContext, null, 2)}`,
    recentHistory.length > 0
      ? `Conversation history (last ${recentHistory.length}):\n${JSON.stringify(recentHistory, null, 2)}`
      : "",
    `User question:\n${question}`,
  ]
    .filter(Boolean)
    .join("\n\n");
};

/**
 * Compresses the chat context to stay within token budgets while retaining
 * analytical value. Removes full sample rows (expensive), keeps column stats
 * and structure metadata.
 */
const compressChatContext = (context) => {
  if (!context) return context;

  if (Array.isArray(context.sheets)) {
    return {
      datasetName: context.datasetName,
      sheetCount: context.sheetCount,
      totalRowCount: context.totalRowCount,
      sheets: context.sheets.map((sheet) => ({
        name: sheet.name,
        rowCount: sheet.rowCount,
        columnCount: sheet.columnCount,
        columns: sheet.columns,
        // Only include 3 sample rows (instead of 30) for reference
        sampleRows: (sheet.sampleRows ?? []).slice(0, 3),
      })),
    };
  }

  // Legacy single-sheet format — pass through as-is (already small)
  return context;
};

/**
 * Defensive: even with responseMimeType="text/plain", Gemini occasionally
 * still wraps replies in JSON (e.g. {"answer":"..."} / {"reply":"..."}).
 * Detect and unwrap so the frontend always gets clean prose.
 */
const sanitizeChatReply = (rawText) => {
  if (typeof rawText !== "string") return "";
  let text = rawText.trim();

  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) {
    text = fence[1].trim();
  }

  // If it parses as JSON and contains a known reply field, unwrap it.
  if (
    (text.startsWith("{") && text.endsWith("}")) ||
    (text.startsWith("[") && text.endsWith("]"))
  ) {
    try {
      const parsed = JSON.parse(text);
      const candidate =
        parsed?.reply ??
        parsed?.answer ??
        parsed?.response ??
        parsed?.message ??
        parsed?.content ??
        parsed?.text;
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        return candidate.trim();
      }
    } catch {
      // Not actually JSON — fall through and return as-is.
    }
  }

  return text;
};

const generateChatResponse = async (
  question,
  columnStats,
  conversationHistory = [],
  { requestId } = {},
) => {
  const prompt = buildChatPrompt(question, columnStats, conversationHistory);
  // Chat is user-facing — fail fast on rate limit (no 61s cooldown stalls).
  // Still allow 2 retries for transient 5xx errors with their fast backoff.
  const result = await callWithRetry(
    () => geminiFlashChat.generateContent(prompt),
    2,
    requestId,
    { maxRateLimitRetries: 0 },
  );
  return sanitizeChatReply(result.response.text());
};

const streamChatResponse = async (
  question,
  columnStats,
  conversationHistory = [],
  { requestId } = {},
) => {
  const prompt = buildChatPrompt(question, columnStats, conversationHistory);
  return callWithRetry(
    () => geminiFlashChat.generateContentStream(prompt),
    2,
    requestId,
    { maxRateLimitRetries: 0 },
  );
};

const generateChatRaw = async (
  question,
  columnStats,
  conversationHistory = [],
  { requestId } = {},
) => {
  const prompt = buildChatPrompt(question, columnStats, conversationHistory);
  const result = await callWithRetry(
    () => geminiFlashChat.generateContent(prompt),
    2,
    requestId,
    { maxRateLimitRetries: 0 },
  );
  return result.response.text();
};

const streamChatRaw = async function* (
  question,
  columnStats,
  conversationHistory = [],
  { requestId } = {},
) {
  const prompt = buildChatPrompt(question, columnStats, conversationHistory);
  const result = await callWithRetry(
    () => geminiFlashChat.generateContentStream(prompt),
    2,
    requestId,
    { maxRateLimitRetries: 0 },
  );
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
};

const isEnabled = () => Boolean(geminiFlash);

export {
  buildChatPrompt,
  parseAndValidateInsights,
  generateInsightsRaw,
  generateChatRaw,
  streamChatRaw,
  sanitizeChatReply,
  isEnabled,
};

export default {
  generateInsights,
  generateChatResponse,
  streamChatResponse,
  generateInsightsRaw,
  generateChatRaw,
  streamChatRaw,
  parseAndValidateInsights,
  sanitizeChatReply,
  isEnabled,
};
