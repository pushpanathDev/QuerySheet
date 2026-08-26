/**
 * LLM provider router.
 *
 * Primary: Groq (llama-3.3-70b-versatile) — chosen because the Gemini free
 * tier daily quota (20 req/day) is too low for development.
 * Fallback: Gemini (gemini-2.5-flash) — used when Groq is not configured,
 * rate-limited, or hits a transient error.
 *
 * Public surface mirrors the legacy `gemini.service.js` so existing callers
 * (analyze.service.js, chat.service.js) only need to change their import.
 */
import env from "../config/env.config.js";
import logger from "../utils/logger.util.js";
import { buildAnalysisPrompt } from "../utils/promptBuilder.util.js";
import geminiService, {
  buildChatPrompt,
  parseAndValidateInsights,
  sanitizeChatReply,
} from "./gemini.service.js";
import groqService from "./groq.service.js";

const FALLBACK_CODES = new Set([
  "GROQ_NOT_CONFIGURED",
  "GROQ_RATE_LIMITED",
  "GROQ_TRANSIENT",
  // Groq sometimes returns malformed JSON in JSON mode — let Gemini retry.
  "LLM_INVALID_OUTPUT",
]);

const shouldFallback = (error) =>
  error && FALLBACK_CODES.has(error.code);

const groqIsPrimary = () =>
  env.LLM_PRIMARY_PROVIDER === "groq" && groqService.isEnabled();

/**
 * Generate structured insights. Tries Groq first (when primary), falls back
 * to Gemini on configurable error codes.
 */
const generateInsights = async (sheetSummaries, datasetName, { requestId } = {}) => {
  if (groqIsPrimary()) {
    try {
      const prompt = buildAnalysisPrompt(sheetSummaries, datasetName);
      const { rawText, finishReason } = await groqService.generateInsightsRaw(
        prompt,
        { requestId },
      );

      if (finishReason && !["stop", "length"].includes(finishReason)) {
        const truncErr = new Error(
          `Groq response truncated (finish_reason=${finishReason})`,
        );
        truncErr.code = "GROQ_TRANSIENT";
        throw truncErr;
      }

      const validated = parseAndValidateInsights(rawText, requestId);
      logger.info("LLM insights generated via Groq", { requestId });
      return validated;
    } catch (error) {
      if (shouldFallback(error)) {
        logger.warn("Groq insights failed; falling back to Gemini", {
          requestId,
          code: error.code,
          message: error.message,
        });
      } else {
        throw error;
      }
    }
  }

  logger.info("LLM insights generated via Gemini", { requestId });
  return geminiService.generateInsights(sheetSummaries, datasetName, { requestId });
};

/**
 * Generate a chat reply (non-streaming). Tries Groq first, falls back to
 * Gemini. Always passes through `sanitizeChatReply` so callers receive clean
 * prose regardless of provider quirks.
 */
const generateChatResponse = async (
  question,
  columnStats,
  conversationHistory = [],
  { requestId } = {},
) => {
  if (groqIsPrimary()) {
    try {
      const prompt = buildChatPrompt(question, columnStats, conversationHistory);
      const rawText = await groqService.generateChatRaw(prompt, { requestId });
      return sanitizeChatReply(rawText);
    } catch (error) {
      if (shouldFallback(error)) {
        logger.warn("Groq chat failed; falling back to Gemini", {
          requestId,
          code: error.code,
        });
      } else {
        throw error;
      }
    }
  }

  return geminiService.generateChatResponse(
    question,
    columnStats,
    conversationHistory,
    { requestId },
  );
};

/**
 * Stream a chat reply. Returns an async iterable that yields plain-text
 * deltas. Falls back to Gemini if Groq stream init fails with a recoverable
 * error code.
 */
const streamChatResponse = async function* (
  question,
  columnStats,
  conversationHistory = [],
  { requestId } = {},
) {
  if (groqIsPrimary()) {
    try {
      const prompt = buildChatPrompt(question, columnStats, conversationHistory);
      let yielded = false;
      // We can't try/catch *across* a yield reliably for individual chunks,
      // but stream init errors throw before the first yield — those are the
      // important ones to fall back on.
      const stream = groqService.streamChatRaw(prompt, { requestId });
      for await (const delta of stream) {
        yielded = true;
        yield delta;
      }
      if (yielded) return;
    } catch (error) {
      if (shouldFallback(error)) {
        logger.warn("Groq stream failed; falling back to Gemini", {
          requestId,
          code: error.code,
        });
        // fall through to Gemini stream below
      } else {
        throw error;
      }
    }
  }

  yield* geminiService.streamChatRaw(
    question,
    columnStats,
    conversationHistory,
    { requestId },
  );
};

export { sanitizeChatReply };

export default {
  generateInsights,
  generateChatResponse,
  streamChatResponse,
  sanitizeChatReply,
};
