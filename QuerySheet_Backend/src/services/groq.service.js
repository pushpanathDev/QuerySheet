import {
  GROQ_CHAT_OPTIONS,
  GROQ_INSIGHTS_OPTIONS,
  GROQ_MODEL,
  groqClient,
  isGroqEnabled,
} from "../config/groq.config.js";
import logger from "../utils/logger.util.js";

const ensureClient = () => {
  if (!isGroqEnabled()) {
    const error = new Error("Groq client is not configured (missing GROQ_API_KEY)");
    error.code = "GROQ_NOT_CONFIGURED";
    throw error;
  }
};

/**
 * Convert a Gemini-style prompt (single string with system + payload joined
 * by blank lines) into Groq's OpenAI-style chat-completion message format.
 * The first paragraph (the role/system instruction) becomes the system
 * message; the rest becomes the user message.
 */
const promptToMessages = (prompt) => {
  const trimmed = prompt.trim();
  const splitIndex = trimmed.indexOf("\n\n");
  if (splitIndex === -1) {
    return [{ role: "user", content: trimmed }];
  }
  const systemContent = trimmed.slice(0, splitIndex).trim();
  const userContent = trimmed.slice(splitIndex + 2).trim();
  return [
    { role: "system", content: systemContent },
    { role: "user", content: userContent },
  ];
};

/**
 * Map common Groq SDK errors to our standard error shape so the higher-level
 * provider router (`llm.service.js`) can decide whether to fail-fast or fall
 * back to Gemini.
 */
const normaliseGroqError = (error) => {
  const status = error?.status ?? error?.response?.status;
  const message = error?.message ?? "Groq request failed";

  const wrapped = new Error(message);
  wrapped.cause = error;
  wrapped.provider = "groq";

  if (status === 429) {
    wrapped.code = "GROQ_RATE_LIMITED";
    wrapped.statusCode = 429;
  } else if (status === 400) {
    wrapped.code = "GROQ_INVALID_REQUEST";
    wrapped.statusCode = 400;
  } else if (status >= 500 || error?.code === "ECONNRESET" || error?.code === "ETIMEDOUT") {
    wrapped.code = "GROQ_TRANSIENT";
    wrapped.statusCode = 502;
  } else {
    wrapped.code = "GROQ_ERROR";
    wrapped.statusCode = status ?? 500;
  }

  return wrapped;
};

/**
 * Insights call — JSON mode on. Returns the raw text (caller parses).
 */
const generateInsightsRaw = async (prompt, { requestId } = {}) => {
  ensureClient();
  const messages = promptToMessages(prompt);

  try {
    const response = await groqClient.chat.completions.create({
      model: GROQ_MODEL,
      messages,
      ...GROQ_INSIGHTS_OPTIONS,
    });

    const choice = response.choices?.[0];
    const rawText = choice?.message?.content ?? "";
    const finishReason = choice?.finish_reason;

    return { rawText, finishReason, usage: response.usage };
  } catch (error) {
    const wrapped = normaliseGroqError(error);
    logger.warn("Groq insights call failed", {
      requestId,
      code: wrapped.code,
      statusCode: wrapped.statusCode,
      message: wrapped.message,
    });
    throw wrapped;
  }
};

/**
 * Chat call — plain text, no JSON wrapping.
 */
const generateChatRaw = async (prompt, { requestId } = {}) => {
  ensureClient();
  const messages = promptToMessages(prompt);

  try {
    const response = await groqClient.chat.completions.create({
      model: GROQ_MODEL,
      messages,
      ...GROQ_CHAT_OPTIONS,
    });
    return response.choices?.[0]?.message?.content ?? "";
  } catch (error) {
    const wrapped = normaliseGroqError(error);
    logger.warn("Groq chat call failed", {
      requestId,
      code: wrapped.code,
      statusCode: wrapped.statusCode,
      message: wrapped.message,
    });
    throw wrapped;
  }
};

/**
 * Streaming chat call — yields content deltas.
 */
const streamChatRaw = async function* (prompt, { requestId } = {}) {
  ensureClient();
  const messages = promptToMessages(prompt);

  let stream;
  try {
    stream = await groqClient.chat.completions.create({
      model: GROQ_MODEL,
      messages,
      ...GROQ_CHAT_OPTIONS,
      stream: true,
    });
  } catch (error) {
    const wrapped = normaliseGroqError(error);
    logger.warn("Groq stream init failed", {
      requestId,
      code: wrapped.code,
      message: wrapped.message,
    });
    throw wrapped;
  }

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) yield delta;
  }
};

export default {
  generateInsightsRaw,
  generateChatRaw,
  streamChatRaw,
  isEnabled: isGroqEnabled,
};
