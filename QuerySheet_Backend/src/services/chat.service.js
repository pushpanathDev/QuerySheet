import { v4 as uuidv4 } from "uuid";
import { FieldValue } from "firebase-admin/firestore";

import createChatMessageDocument from "../models/chat.model.js";
import {
  getCachedChatAnswer,
  setCachedChatAnswer,
} from "../utils/geminiThrottle.util.js";
import logger from "../utils/logger.util.js";
import cacheService from "./cache.service.js";
import llmService from "./llm.service.js";

const sanitizeChatReply = llmService.sanitizeChatReply;

// Fire-and-forget: update lastMessageAt and increment messageCount on the
// parent analysis document so the dashboard can sort by recent activity and
// show unread/message counts without reading every messages subcollection.
const touchAnalysisActivity = (uid, analysisId, messageIncrement = 2) => {
  cacheService
    .updateAnalysis(uid, analysisId, {
      lastMessageAt: FieldValue.serverTimestamp(),
      messageCount: FieldValue.increment(messageIncrement),
    })
    .catch((error) => {
      logger.warn("Failed to update analysis activity", {
        uid,
        analysisId,
        error: error?.message,
      });
    });
};

const buildConversationHistory = (history) =>
  history.slice(-5).map((message) => ({
    role: message.role === "user" ? "user" : "model",
    content: message.content,
  }));

/**
 * Deterministic answers for common metadata questions. Avoids Gemini calls
 * (and thus rate-limit/latency issues) for questions whose answer is already
 * known from the persisted analysis document.
 *
 * Returns a string when the question is handled locally, otherwise null.
 */
const answerFromMetadata = (question, analysis) => {
  const q = question.toLowerCase().trim();
  const sheets = Array.isArray(analysis.sheets) ? analysis.sheets : null;

  // "How many sheets / worksheets / tabs are there?"
  if (
    /\bhow many\b.*\b(sheet|worksheet|tab)s?\b/.test(q) ||
    /\b(sheet|worksheet|tab)\s+count\b/.test(q) ||
    /\bnumber of\s+(sheet|worksheet|tab)s?\b/.test(q)
  ) {
    const count = sheets ? sheets.length : 1;
    const names = sheets
      ? sheets.map((s) => `'${s.name}'`).join(", ")
      : `'${analysis.datasetName ?? "Sheet1"}'`;
    return `There ${count === 1 ? "is" : "are"} ${count} ${count === 1 ? "sheet" : "sheets"} in this dataset: ${names}.`;
  }

  // "What sheets / what are the sheet names?"
  if (
    /\b(what|which|list)\b.*\b(sheet|worksheet|tab)s?\b.*\bname/.test(q) ||
    /\bsheet names?\b/.test(q) ||
    /\blist (the |all )?(sheet|worksheet|tab)s?\b/.test(q) ||
    /\bnames? of (the )?(sheet|worksheet|tab)s?\b/.test(q)
  ) {
    if (sheets) {
      return `The dataset contains ${sheets.length} sheet${sheets.length === 1 ? "" : "s"}: ${sheets.map((s) => `'${s.name}' (${s.rowCount} rows, ${s.headers?.length ?? 0} columns)`).join("; ")}.`;
    }
    return `This dataset has a single sheet: '${analysis.datasetName ?? "Sheet1"}'.`;
  }

  // "How many rows / records are there [in <sheet>]?"
  const rowMatch = q.match(
    /\bhow many\b.*\b(row|record|entr(?:y|ies))s?\b(?:.*\b(?:in|of|for)\b\s+(?:the\s+)?['"]?([\w\s-]+?)['"]?\s*(?:sheet|worksheet|tab)?)?/,
  );
  if (rowMatch) {
    const sheetHint = rowMatch[2]?.trim();
    if (sheets && sheetHint) {
      const target = sheets.find(
        (s) => s.name.toLowerCase() === sheetHint.toLowerCase(),
      );
      if (target) {
        return `Sheet '${target.name}' has ${target.rowCount} rows.`;
      }
    }
    return `The dataset has ${analysis.rowCount ?? 0} total rows${
      sheets && sheets.length > 1
        ? ` across ${sheets.length} sheets (${sheets.map((s) => `${s.name}: ${s.rowCount}`).join(", ")})`
        : ""
    }.`;
  }

  // "How many columns [in <sheet>]?" / "List columns in <sheet>"
  const colMatch = q.match(
    /\b(how many|what|which|list|name)\b.*\b(column|field|header)s?\b(?:.*\b(?:in|of|for)\b\s+(?:the\s+)?['"]?([\w\s-]+?)['"]?\s*(?:sheet|worksheet|tab)?)?/,
  );
  if (colMatch) {
    const sheetHint = colMatch[3]?.trim();
    let targetSheet = null;
    if (sheets) {
      if (sheetHint) {
        targetSheet = sheets.find(
          (s) => s.name.toLowerCase() === sheetHint.toLowerCase(),
        );
      }
      if (!targetSheet && sheets.length === 1) {
        targetSheet = sheets[0];
      }
    }

    const headers = targetSheet
      ? targetSheet.headers
      : (analysis.headers ?? Object.keys(analysis.columnStats ?? {}));
    const sheetLabel = targetSheet
      ? `'${targetSheet.name}'`
      : analysis.datasetName
        ? `'${analysis.datasetName}'`
        : "the dataset";

    const isCount = /how many/.test(q);
    if (isCount) {
      return `Sheet ${sheetLabel} has ${headers.length} columns.`;
    }
    return `Sheet ${sheetLabel} has these ${headers.length} columns: ${headers.map((h) => `'${h}'`).join(", ")}.`;
  }

  // "What is the dataset name?"
  if (
    /\b(what(?:'s| is)?|name of)\b.*\b(dataset|file)\b.*\bname/.test(q) ||
    /\bdataset name\b/.test(q)
  ) {
    return `The dataset is named '${analysis.datasetName ?? "(unnamed)"}'.`;
  }

  return null;
};

const buildChatContext = (analysis) => {
  // Prefer multi-sheet context when present.
  if (Array.isArray(analysis.sheets) && analysis.sheets.length > 0) {
    return {
      datasetName: analysis.datasetName,
      sheetCount: analysis.sheets.length,
      totalRowCount: analysis.rowCount,
      sheets: analysis.sheets.map((sheet) => ({
        name: sheet.name,
        rowCount: sheet.rowCount,
        columnCount: sheet.headers?.length ?? 0,
        columns: sheet.columnStats ?? {},
        // Cap sample rows at 5 to keep prompt tokens manageable.
        // The LLM only needs a few examples to understand the data shape.
        sampleRows: (sheet.sampleRows ?? []).slice(0, 5),
      })),
    };
  }

  // Legacy single-sheet context.
  return {
    datasetName: analysis.datasetName,
    columnCount: Object.keys(analysis.columnStats ?? {}).length,
    columnStats: analysis.columnStats ?? {},
  };
};

const sendMessage = async (uid, analysisId, userMessage) => {
  const analysis = await cacheService.getAnalysis(uid, analysisId);

  if (!analysis || analysis.isDeleted) {
    const error = new Error("Analysis not found");
    error.statusCode = 404;
    throw error;
  }

  // Try to answer metadata questions deterministically — saves a Gemini call
  // (and the rate-limit / latency that comes with it) for trivially answerable
  // structural questions like sheet count, column lists, row counts.
  const metadataAnswer = answerFromMetadata(userMessage, analysis);

  let assistantResponseText;
  let cacheHit = false;
  if (metadataAnswer) {
    logger.info("Chat answered from metadata (no Gemini call)", {
      uid,
      analysisId,
      question: userMessage.slice(0, 80),
    });
    assistantResponseText = metadataAnswer;
  } else {
    // Q&A cache — repeat questions during dev/testing return instantly.
    const cached = getCachedChatAnswer(uid, analysisId, userMessage);
    if (cached) {
      logger.info("Chat answered from Q&A cache (no Gemini call)", {
        uid,
        analysisId,
        question: userMessage.slice(0, 80),
      });
      assistantResponseText = sanitizeChatReply(cached);
      cacheHit = true;
    } else {
      const history = await cacheService.getChatHistory(uid, analysisId);
      const conversationHistory = buildConversationHistory(history);
      const context = buildChatContext(analysis);

      assistantResponseText = await llmService.generateChatResponse(
        userMessage,
        context,
        conversationHistory,
      );
      setCachedChatAnswer(uid, analysisId, userMessage, assistantResponseText);
    }
  }
  void cacheHit;

  const turnId = uuidv4();
  const userMessageId = uuidv4();
  const assistantMessageId = uuidv4();

  const userDoc = createChatMessageDocument({
    messageId: userMessageId,
    userId: uid,
    analysisId,
    role: "user",
    turnId,
    turnIndex: 0,
    content: userMessage,
  });

  const assistantDoc = createChatMessageDocument({
    messageId: assistantMessageId,
    userId: uid,
    analysisId,
    role: "assistant",
    turnId,
    turnIndex: 1,
    content: assistantResponseText,
  });

  await cacheService.saveChatMessage(uid, analysisId, userMessageId, userDoc);
  await cacheService.saveChatMessage(uid, analysisId, assistantMessageId, assistantDoc);

  // user message + assistant message = 2
  touchAnalysisActivity(uid, analysisId, 2);

  return {
    // Canonical field — frontend should consume this.
    reply: assistantResponseText,
    // Legacy aliases (kept for backward-compat during transition).
    content: assistantResponseText,
    answer: assistantResponseText,
    messageId: assistantMessageId,
    turnId,
    role: "assistant",
    timestamp: new Date().toISOString(),
  };
};

const getHistory = async (uid, analysisId) => {
  const messages = (await cacheService.getChatHistory(uid, analysisId)).slice(
    -50,
  );
  // Normalise each message so the frontend has consistent fields:
  //  - `reply` is the canonical text field (matches /chat response)
  //  - `content` kept for backward-compat
  //  - timestamps coerced to ISO strings (Firestore Timestamps are not JSON-friendly)
  return messages.map((msg) => {
    const sanitized =
      msg.role === "assistant"
        ? sanitizeChatReply(msg.content ?? "")
        : (msg.content ?? "");
    const createdAt =
      msg.createdAt?.toDate?.()?.toISOString?.() ??
      msg.createdAt ??
      null;
    return {
      messageId: msg.messageId,
      role: msg.role,
      turnId: msg.turnId ?? null,
      turnIndex: msg.turnIndex ?? null,
      reply: sanitized,
      content: sanitized,
      createdAt,
    };
  });
};

const streamMessage = async function* (uid, analysisId, userMessage) {
  const analysis = await cacheService.getAnalysis(uid, analysisId);
  if (!analysis || analysis.isDeleted) {
    const error = new Error("Analysis not found");
    error.statusCode = 404;
    throw error;
  }

  // Metadata fast-path — yield the deterministic answer as a single chunk
  // and persist it without calling Gemini.
  const metadataAnswer = answerFromMetadata(userMessage, analysis);
  if (metadataAnswer) {
    logger.info("Stream chat answered from metadata (no Gemini call)", {
      uid,
      analysisId,
      question: userMessage.slice(0, 80),
    });
    yield metadataAnswer;

    const turnId = uuidv4();
    const userMessageId = uuidv4();
    const assistantMessageId = uuidv4();
    await cacheService.saveChatMessage(
      uid,
      analysisId,
      userMessageId,
      createChatMessageDocument({
        messageId: userMessageId,
        userId: uid,
        analysisId,
        role: "user",
        turnId,
        turnIndex: 0,
        content: userMessage,
      }),
    );
    await cacheService.saveChatMessage(
      uid,
      analysisId,
      assistantMessageId,
      createChatMessageDocument({
        messageId: assistantMessageId,
        userId: uid,
        analysisId,
        role: "assistant",
        turnId,
        turnIndex: 1,
        content: metadataAnswer,
      }),
    );
    touchAnalysisActivity(uid, analysisId, 2);
    return;
  }

  const history = await cacheService.getChatHistory(uid, analysisId);
  const conversationHistory = buildConversationHistory(history);
  const context = buildChatContext(analysis);

  let assembledMessage = "";
  for await (const chunk of llmService.streamChatResponse(
    userMessage,
    context,
    conversationHistory,
  )) {
    assembledMessage += chunk;
    yield chunk;
  }

  // Persist the sanitized form so chat history is never JSON-wrapped.
  const persistedContent = sanitizeChatReply(assembledMessage);

  const turnId = uuidv4();
  const userMessageId = uuidv4();
  const assistantMessageId = uuidv4();

  const userDoc = createChatMessageDocument({
    messageId: userMessageId,
    userId: uid,
    analysisId,
    role: "user",
    turnId,
    turnIndex: 0,
    content: userMessage,
  });

  const assistantDoc = createChatMessageDocument({
    messageId: assistantMessageId,
    userId: uid,
    analysisId,
    role: "assistant",
    turnId,
    turnIndex: 1,
    content: persistedContent,
  });

  await cacheService.saveChatMessage(uid, analysisId, userMessageId, userDoc);
  await cacheService.saveChatMessage(uid, analysisId, assistantMessageId, assistantDoc);
  touchAnalysisActivity(uid, analysisId, 2);
};

export default {
  sendMessage,
  getHistory,
  streamMessage,
};
