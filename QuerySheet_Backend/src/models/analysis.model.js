import { FieldValue, Timestamp } from "firebase-admin/firestore";

export const createAnalysisDocument = ({
  analysisId,
  userId,
  datasetName,
  // New multi-sheet fields
  sheets = null,
  sheetCount = null,
  // Legacy fields (also represent the first/primary sheet)
  headers,
  rowCount,
  columnStats,
  insights,
  chartData = [],
  aiSummary = null,
  dataHash,
}) => ({
  analysisId,
  userId,
  datasetName,
  sheets,
  sheetCount,
  headers,
  rowCount,
  columnStats,
  insights,
  chartData,
  aiSummary,
  dataHash,
  status: "completed",
  messageCount: 0,
  lastMessageAt: null,
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
  completedAt: Timestamp.fromDate(new Date()),
  schemaVersion: 2,
});

export default createAnalysisDocument;
