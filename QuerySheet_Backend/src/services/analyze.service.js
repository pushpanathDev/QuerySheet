import { createHash } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { v4 as uuidv4 } from "uuid";

import { db } from "../config/firebase.config.js";
import createAnalysisDocument from "../models/analysis.model.js";
import logger from "../utils/logger.util.js";
import { mapInsightsToResponse } from "../utils/responseMapper.util.js";
import cacheService from "./cache.service.js";
import llmService from "./llm.service.js";

const TOP_VALUES_LIMIT = 5;

const isNullLike = (value) =>
  value === null ||
  value === undefined ||
  (typeof value === "string" && value.trim() === "");

const toNumeric = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const computeStats = (numbers) => {
  if (numbers.length === 0) {
    return { min: null, max: null, mean: null, stdDev: null };
  }
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  const mean = numbers.reduce((acc, val) => acc + val, 0) / numbers.length;
  const variance =
    numbers.length > 1
      ? numbers.reduce((acc, val) => acc + (val - mean) ** 2, 0) / numbers.length
      : 0;
  return { min, max, mean, stdDev: Math.sqrt(variance) };
};

const getTopValues = (values) => {
  const frequencies = new Map();
  values.forEach((value) => {
    const key = String(value);
    frequencies.set(key, (frequencies.get(key) ?? 0) + 1);
  });

  return Array.from(frequencies.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_VALUES_LIMIT)
    .map(([value, count]) => ({ value, count }));
};

const detectColumnType = (nonNullValues) => {
  if (nonNullValues.length === 0) {
    return "categorical";
  }

  const numericCount = nonNullValues.filter((value) => toNumeric(value) !== null).length;
  if (numericCount / nonNullValues.length > 0.8) {
    return "numeric";
  }

  const dateCount = nonNullValues.filter((value) => toDate(value) !== null).length;
  if (dateCount / nonNullValues.length > 0.8) {
    return "date";
  }

  return "categorical";
};

const buildColumnStats = (headers, rows) => {
  const columnStats = {};

  headers.forEach((header) => {
    const allValues = rows.map((row) => row[header]);
    const nonNullValues = allValues.filter((value) => !isNullLike(value));
    const nullCount = allValues.length - nonNullValues.length;
    const nullRatio = allValues.length === 0 ? 0 : nullCount / allValues.length;

    if (nullRatio > 0.5) {
      return;
    }

    const type = detectColumnType(nonNullValues);

    const uniqueValues = new Set(nonNullValues.map((value) => String(value)));

    const stats = {
      type,
      nullCount,
      uniqueCount: uniqueValues.size,
      min: null,
      max: null,
      mean: null,
      stdDev: null,
      topValues: [],
    };

    if (type === "numeric") {
      const numericValues = nonNullValues
        .map((value) => toNumeric(value))
        .filter((value) => value !== null);

      const { min, max, mean, stdDev } = computeStats(numericValues);
      stats.min = min;
      stats.max = max;
      stats.mean = mean;
      stats.stdDev = stdDev;
    } else {
      stats.topValues = getTopValues(nonNullValues);
    }

    columnStats[header] = stats;
  });

  return columnStats;
};

const computeDataHash = (headers, rowCount) => {
  return createHash("md5")
    .update(`${JSON.stringify([...headers].sort())}${rowCount}`)
    .digest("hex");
};

const computeMultiSheetHash = (sheets) => {
  const signature = sheets
    .map(
      (sheet) =>
        `${sheet.name}|${[...sheet.headers].sort().join(",")}|${sheet.rows.length}`,
    )
    .join("||");
  return createHash("md5").update(signature).digest("hex");
};

const SAMPLE_ROW_LIMIT = 30;

const normalizeSheets = (body) => {
  if (Array.isArray(body.sheets) && body.sheets.length > 0) {
    return body.sheets.map((sheet) => ({
      name: sheet.name,
      headers: sheet.headers,
      rows: sheet.rows,
    }));
  }
  // Legacy single-sheet payload
  return [
    {
      name: body.datasetName || "Sheet1",
      headers: body.headers,
      rows: body.rows,
    },
  ];
};

const buildSheetSummaries = (sheets) =>
  sheets.map((sheet) => ({
    name: sheet.name,
    headers: sheet.headers,
    rowCount: sheet.rows.length,
    columnStats: buildColumnStats(sheet.headers, sheet.rows),
    sampleRows: sheet.rows.slice(0, SAMPLE_ROW_LIMIT),
  }));

const incrementAnalysisCount = async (uid) => {
  const profileRef = db
    .collection("users")
    .doc(uid)
    .collection("profile")
    .doc("data");

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(profileRef);
    if (!snapshot.exists) {
      transaction.set(profileRef, {
        uid,
        analysisCount: 1,
        updatedAt: FieldValue.serverTimestamp(),
        schemaVersion: 1,
      });
      return;
    }

    const current = snapshot.data().analysisCount ?? 0;
    transaction.update(profileRef, {
      analysisCount: current + 1,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
};

const validateAndPrepare = (uid, body, { isAnonymous }) => {
  const { datasetName } = body;
  const sheets = normalizeSheets(body);

  if (sheets.length === 0) {
    const error = new Error("At least one sheet is required");
    error.statusCode = 400;
    throw error;
  }

  for (const sheet of sheets) {
    if (!Array.isArray(sheet.rows) || sheet.rows.length === 0) {
      const error = new Error(`Sheet '${sheet.name}' has no rows`);
      error.statusCode = 400;
      throw error;
    }
  }

  const totalRowCount = sheets.reduce((acc, s) => acc + s.rows.length, 0);

  if (isAnonymous && totalRowCount > 100) {
    const error = new Error(
      "Anonymous demo mode is limited to 100 rows total",
    );
    error.statusCode = 403;
    throw error;
  }

  const analysisId = uuidv4();
  const sheetSummaries = buildSheetSummaries(sheets);
  const dataHash = computeMultiSheetHash(sheets);

  return {
    datasetName,
    sheets,
    sheetSummaries,
    totalRowCount,
    analysisId,
    dataHash,
  };
};

const fetchOrGenerateInsights = async (
  uid,
  { sheetSummaries, datasetName, dataHash, analysisId, totalRowCount, sheets },
  { requestId },
) => {
  let geminiOutput = null;
  try {
    const cached = await cacheService.getCachedInsights(uid, dataHash);
    if (cached) {
      logger.info("Analysis insights cache hit", {
        requestId,
        uid,
        analysisId,
        dataHash,
      });
      geminiOutput = cached.insights;
    }
  } catch (error) {
    if (error?.code !== "INSIGHT_CACHE_MISS") {
      throw error;
    }
  }

  if (!geminiOutput) {
    logger.info("Analysis insights cache miss", {
      requestId,
      uid,
      analysisId,
      dataHash,
      sheetCount: sheets.length,
      totalRowCount,
    });
    geminiOutput = await llmService.generateInsights(
      sheetSummaries,
      datasetName,
      { requestId },
    );
    await cacheService.setCachedInsights(uid, dataHash, geminiOutput);
  }

  return mapInsightsToResponse(
    geminiOutput,
    analysisId,
    datasetName,
    sheetSummaries,
    totalRowCount,
  );
};

/**
 * Synchronous analysis — used for anonymous (no persistence to poll) and tests.
 * Returns the full mapped response in one shot.
 */
const runAnalysis = async (
  uid,
  body,
  { isAnonymous = false, requestId } = {},
) => {
  const prep = validateAndPrepare(uid, body, { isAnonymous });
  const mappedResponse = await fetchOrGenerateInsights(uid, prep, { requestId });

  if (!isAnonymous) {
    const primarySheet = prep.sheetSummaries[0];
    const analysisDocument = createAnalysisDocument({
      analysisId: prep.analysisId,
      userId: uid,
      datasetName: prep.datasetName,
      sheets: prep.sheetSummaries,
      sheetCount: prep.sheetSummaries.length,
      headers: primarySheet.headers,
      columnStats: primarySheet.columnStats,
      rowCount: prep.totalRowCount,
      insights: mappedResponse.insights,
      chartData: mappedResponse.chartData,
      aiSummary: mappedResponse.aiSummary,
      dataHash: prep.dataHash,
    });
    await cacheService.saveAnalysis(uid, prep.analysisId, analysisDocument);
    await incrementAnalysisCount(uid);
  }

  return mappedResponse;
};

/**
 * Asynchronous analysis pipeline.
 * 1. Persists a "processing" placeholder doc and returns immediately.
 * 2. Schedules a background job that calls Gemini and patches the doc to
 *    "completed" (or "failed") so the frontend can poll GET /analyze/:id.
 *
 * Anonymous users still go through runAnalysis (synchronous) since they have
 * no persisted document to poll.
 */
const enqueueAnalysis = async (uid, body, { requestId } = {}) => {
  const prep = validateAndPrepare(uid, body, { isAnonymous: false });
  const primarySheet = prep.sheetSummaries[0];

  // Persist initial "processing" document with everything we know
  // synchronously (headers, sheet schemas, column stats). Insights/charts/
  // summary are filled in by the background job.
  const initialDoc = createAnalysisDocument({
    analysisId: prep.analysisId,
    userId: uid,
    datasetName: prep.datasetName,
    sheets: prep.sheetSummaries,
    sheetCount: prep.sheetSummaries.length,
    headers: primarySheet.headers,
    columnStats: primarySheet.columnStats,
    rowCount: prep.totalRowCount,
    insights: [],
    chartData: [],
    aiSummary: null,
    dataHash: prep.dataHash,
  });

  // Override status to "processing" — the model factory marks it "completed"
  // by default, but the document is incomplete at this point.
  initialDoc.status = "processing";
  delete initialDoc.completedAt;

  await cacheService.saveAnalysis(uid, prep.analysisId, initialDoc);

  logger.info("Analysis enqueued", {
    requestId,
    uid,
    analysisId: prep.analysisId,
    dataHash: prep.dataHash,
    sheetCount: prep.sheetSummaries.length,
    totalRowCount: prep.totalRowCount,
  });

  // Fire-and-forget background job. We deliberately do NOT await this so the
  // HTTP request returns immediately. Errors are caught and persisted.
  setImmediate(() => {
    void processAnalysisJob(uid, prep, { requestId });
  });

  return {
    analysisId: prep.analysisId,
    status: "processing",
    datasetName: prep.datasetName,
    rowCount: prep.totalRowCount,
    sheetCount: prep.sheetSummaries.length,
    sheets: prep.sheetSummaries.map((sheet) => ({
      name: sheet.name,
      headers: sheet.headers,
      rowCount: sheet.rowCount,
    })),
  };
};

const processAnalysisJob = async (uid, prep, { requestId }) => {
  const startedAt = Date.now();
  try {
    const mappedResponse = await fetchOrGenerateInsights(uid, prep, {
      requestId,
    });

    await cacheService.updateAnalysis(uid, prep.analysisId, {
      status: "completed",
      insights: mappedResponse.insights,
      chartData: mappedResponse.chartData,
      aiSummary: mappedResponse.aiSummary,
      completedAt: new Date(),
    });

    await incrementAnalysisCount(uid);

    logger.info("Analysis job completed", {
      requestId,
      uid,
      analysisId: prep.analysisId,
      durationMs: Date.now() - startedAt,
      insightCount: mappedResponse.insights.length,
    });
  } catch (error) {
    logger.error("Analysis job failed", {
      requestId,
      uid,
      analysisId: prep.analysisId,
      durationMs: Date.now() - startedAt,
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });

    try {
      await cacheService.updateAnalysis(uid, prep.analysisId, {
        status: "failed",
        errorMessage:
          error?.message ?? "Analysis failed due to an unknown error",
        errorCode: error?.code ?? null,
        failedAt: new Date(),
      });
    } catch (persistErr) {
      logger.error("Failed to persist analysis failure state", {
        requestId,
        uid,
        analysisId: prep.analysisId,
        message: persistErr?.message,
      });
    }
  }
};

const getAnalysis = async (uid, analysisId) =>
  cacheService.getAnalysis(uid, analysisId);

const deleteAnalysis = async (uid, analysisId) => {
  await cacheService.deleteAnalysis(uid, analysisId);
};

const listAnalyses = async (uid) => cacheService.getAllAnalyses(uid);

export default {
  runAnalysis,
  enqueueAnalysis,
  getAnalysis,
  deleteAnalysis,
  listAnalyses,
};
