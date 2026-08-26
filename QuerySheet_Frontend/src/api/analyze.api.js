import apiClient from './client'
import { log } from '../utils/logger.util'

const analyzeLog = log.scope('analyze.api')

// AI analysis can take 30–90s depending on dataset size and Gemini latency.
// Use a generous per-request timeout instead of bumping the global default.
const ANALYZE_TIMEOUT_MS = 120_000

/**
 * Submits a parsed dataset for AI analysis.
 * @param {{ datasetName: string, sheets?: Array, rows?: object[], headers?: string[] }} payload
 * @returns {Promise<object>} Full analysis document (envelope unwrapped by client)
 */
export async function submitAnalysis(payload) {
  analyzeLog.groupCollapsed('submitAnalysis →', () => {
    analyzeLog.info('datasetName:', payload.datasetName)
    analyzeLog.info('headers:', payload.headers)
    analyzeLog.info('rowCount:', payload.rows?.length)
    analyzeLog.info('sheetCount:', payload.sheets?.length)
  })
  const { data } = await apiClient.post('/analyze', payload, {
    timeout: ANALYZE_TIMEOUT_MS,
  })
  return data
}

/**
 * Fetches an existing analysis by ID.
 * @param {string} analysisId
 */
export async function getAnalysis(analysisId) {
  const { data } = await apiClient.get(`/analyze/${analysisId}`)
  return data
}

/**
 * Lists all analyses for the authenticated user, ordered by createdAt desc.
 * Each item includes: analysisId, datasetName, rowCount, headers, insights,
 * chartData, aiSummary, createdAt, status, messageCount, lastMessageAt, dataHash.
 * @returns {Promise<object[]>}
 */
export async function listAnalyses() {
  const { data } = await apiClient.get('/analyze')
  return Array.isArray(data) ? data : []
}

/**
 * Deletes an analysis document and its associated chat history.
 * Requires backend route: DELETE /api/v1/analyze/:analysisId
 * @param {string} analysisId
 */
export async function deleteAnalysis(analysisId) {
  const { data } = await apiClient.delete(`/analyze/${analysisId}`)
  return data
}

// Chat helpers moved to ./chat.api.js — backend now owns history persistence
// and exposes them under /chat instead of /analyze/{id}/chat.
