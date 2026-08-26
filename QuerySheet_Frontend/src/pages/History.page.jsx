import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listAnalyses, getAnalysis, deleteAnalysis } from '../api/analyze.api'
import useAnalysisStore from '../store/analysis.store'
import { log } from '../utils/logger.util'
import { Spinner, PageLoader } from '../components/common/Loader'

const histLog = log.scope('History')

/** Cached data is considered fresh for this long before a background re-fetch. */
const STALE_MS = 5 * 60 * 1000

// ─── Date helpers ────────────────────────────────────────────────────────────

/**
 * Normalises any date-like value the backend might send into a JS Date:
 *   - ISO string / timestamp number       → new Date(val)
 *   - Firestore Timestamp object          → { _seconds, _nanoseconds } or { seconds, nanoseconds }
 * Returns null if the value cannot be converted.
 */
function toDate(val) {
  if (!val) return null
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val
  // Firestore Timestamp serialised as a plain object
  const secs = val._seconds ?? val.seconds
  if (typeof secs === 'number') return new Date(secs * 1000)
  // ISO string or Unix-ms number
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

/** "Jun 3, 2026 at 4:15 PM" */
function formatFull(val) {
  const d = toDate(val)
  if (!d) return null
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** "Jun 3 at 4:15 PM" (no year — used when same-year context is clear) */
function formatShort(val) {
  const d = toDate(val)
  if (!d) return null
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** "2h ago", "3d ago", etc. Returns null for values older than 7 days. */
function formatRelative(val) {
  const d = toDate(val)
  if (!d) return null
  const diffMs = Date.now() - d.getTime()
  if (isNaN(diffMs) || diffMs < 0) return null
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return null
}

// ─── Grouping ─────────────────────────────────────────────────────────────────

/**
 * Groups analyses by dataHash. Same-content datasets are shown as "runs".
 * Analyses without a dataHash each form their own group.
 */
function groupByDataHash(analyses) {
  const map = new Map()
  for (const a of analyses) {
    const key = a.dataHash ?? `solo-${a.analysisId}`
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(a)
  }
  return [...map.values()]
    .map((items) =>
      [...items].sort((a, b) => {
        const da = toDate(b.createdAt)
        const db = toDate(a.createdAt)
        return (da?.getTime() ?? 0) - (db?.getTime() ?? 0)
      })
    )
    .sort((a, b) => {
      const da = toDate(b[0].createdAt)
      const db = toDate(a[0].createdAt)
      return (da?.getTime() ?? 0) - (db?.getTime() ?? 0)
    })
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ChatBadge({ count }) {
  if (!count) return null
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-soft text-brand text-xs font-medium rounded-full border border-brand/30 shrink-0">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
        />
      </svg>
      {count}
    </span>
  )
}

function AnalysisCard({ analysis, onChat, onDashboard, onDelete, loadingId }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const isDashboardLoading = loadingId === analysis.analysisId

  const createdFull = formatFull(analysis.createdAt)
  const createdRelative = formatRelative(analysis.createdAt)
  const lastChatFull = formatFull(analysis.lastMessageAt)
  const lastChatShort = formatShort(analysis.lastMessageAt)
  const lastChatRelative = formatRelative(analysis.lastMessageAt)

  async function handleConfirmDelete() {
    setIsDeleting(true)
    await onDelete(analysis.analysisId)
    // onDelete removes the card from the list; if it fails the card stays and
    // we just reset the confirmation state.
    setIsDeleting(false)
    setConfirmDelete(false)
  }

  return (
    <div className="bg-white border border-line rounded-2xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 h-full">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-display font-bold text-ink truncate min-w-0" title={analysis.datasetName}>
          {analysis.datasetName}
        </p>
        <ChatBadge count={analysis.messageCount} />
      </div>

      {/* Dates — shown as full date+time so the user can distinguish same-named datasets */}
      <div className="space-y-1">
        {createdFull ? (
          <p className="text-xs text-muted">
            <span className="font-medium text-body">Analyzed </span>
            <span title={createdRelative ?? undefined}>{createdFull}</span>
            {createdRelative && (
              <span className="text-muted ml-1">({createdRelative})</span>
            )}
          </p>
        ) : (
          <p className="text-xs text-muted italic">No analysis date</p>
        )}

        {lastChatFull ? (
          <p className="text-xs text-muted">
            <span className="font-medium text-body">Last chat </span>
            <span title={lastChatRelative ?? undefined}>{lastChatShort ?? lastChatFull}</span>
            {lastChatRelative && (
              <span className="text-muted ml-1">({lastChatRelative})</span>
            )}
          </p>
        ) : (
          <p className="text-xs text-muted">No chats yet</p>
        )}

        {analysis.rowCount != null && (
          <p className="text-xs text-muted">{analysis.rowCount.toLocaleString()} rows</p>
        )}
      </div>

      {/* Actions */}
      {confirmDelete ? (
        <div className="mt-auto">
          <p className="text-xs font-semibold text-red-600 mb-2">
            Delete this analysis and all its chats?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {isDeleting ? <Spinner size="xs" tone="white" /> : null}
              {isDeleting ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              disabled={isDeleting}
              className="flex-1 px-3 py-1.5 border border-line text-body hover:bg-black/5 hover:text-ink text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 mt-auto">
          <button
            type="button"
            onClick={() => onChat(analysis)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-black text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            Chat
          </button>

          <button
            type="button"
            onClick={() => onDashboard(analysis)}
            disabled={isDashboardLoading}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border border-line text-body hover:bg-black/5 hover:text-ink text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDashboardLoading ? (
              <Spinner size="xs" tone="ink" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            )}
            Dashboard
          </button>

          {/* Delete — opens inline confirmation on click */}
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            title="Delete this analysis"
            className="shrink-0 p-1.5 text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const navigate = useNavigate()

  // Store slices
  const historyList     = useAnalysisStore((s) => s.historyList)
  const historyFetchedAt = useAnalysisStore((s) => s.historyFetchedAt)
  const setHistory      = useAnalysisStore((s) => s.setHistory)
  const removeFromHistory = useAnalysisStore((s) => s.removeFromHistory)
  const setAnalysis     = useAnalysisStore((s) => s.setAnalysis)
  const clearAnalysis   = useAnalysisStore((s) => s.clearAnalysis)
  const currentAnalysisId = useAnalysisStore((s) => s.analysisId)

  const isStale = !historyFetchedAt || Date.now() - historyFetchedAt > STALE_MS
  const hasCache = historyList.length > 0

  // Full-screen spinner only when there is no cached data to show.
  const [isLoading, setIsLoading] = useState(!hasCache && isStale)
  // Subtle top-bar indicator when refreshing in the background.
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [loadingId, setLoadingId] = useState(null)
  const [deleteError, setDeleteError] = useState('')

  // Derive groups from the cached list without re-sorting on every render.
  const groups = useMemo(() => groupByDataHash(historyList), [historyList])

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchHistory = useCallback(async () => {
    setError('')
    try {
      const analyses = await listAnalyses()
      setHistory(analyses)
    } catch (err) {
      histLog.error('listAnalyses failed:', err.code, err.message)
      // Only surface the error if there is nothing cached to fall back on.
      if (!hasCache) setError('Could not load analysis history. Please try again.')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [setHistory, hasCache])

  useEffect(() => {
    if (!isStale) return
    if (hasCache) {
      // Show stale data immediately; fetch silently in the background.
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    fetchHistory()
  }, []) // intentionally runs once on mount

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleChat = useCallback(
    (analysis) => {
      setAnalysis({
        analysisId: analysis.analysisId,
        datasetName: analysis.datasetName,
        rowCount: analysis.rowCount ?? null,
      })
      navigate('/chat')
    },
    [setAnalysis, navigate]
  )

  const handleDashboard = useCallback(
    async (analysis) => {
      setLoadingId(analysis.analysisId)
      try {
        const full = await getAnalysis(analysis.analysisId)
        setAnalysis(full)
      } catch (err) {
        histLog.warn('getAnalysis fallback to summary:', err.code, err.message)
        setAnalysis({
          analysisId: analysis.analysisId,
          datasetName: analysis.datasetName,
          rowCount: analysis.rowCount ?? null,
        })
      } finally {
        setLoadingId(null)
        navigate('/dashboard')
      }
    },
    [setAnalysis, navigate]
  )

  const handleDelete = useCallback(
    async (analysisId) => {
      setDeleteError('')
      try {
        await deleteAnalysis(analysisId)
        // Optimistically remove from cache.
        removeFromHistory(analysisId)
        // If this was the active analysis, clear it so Dashboard/Chat don't
        // show stale data from a deleted document.
        if (currentAnalysisId === analysisId) clearAnalysis()
      } catch (err) {
        histLog.error('deleteAnalysis failed:', err.code, err.message)
        setDeleteError(
          err?.code === 'HTTP_404'
            ? 'Delete is not yet supported by the server.'
            : 'Failed to delete. Please try again.'
        )
      }
    },
    [removeFromHistory, clearAnalysis, currentAnalysisId]
  )

  const handleManualRefresh = () => {
    setIsRefreshing(true)
    fetchHistory()
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const totalAnalyses = groups.reduce((n, g) => n + g.length, 0)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Subtle background-refresh indicator */}
      {isRefreshing && (
        <div className="fixed top-14 left-0 right-0 h-0.5 bg-brand/20 z-20 overflow-hidden">
          <div className="h-full bg-brand animate-pulse w-1/2 mx-auto" />
        </div>
      )}

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-ink">Analysis History</h1>
          {!isLoading && !error && (
            <p className="text-sm text-muted mt-0.5">
              {totalAnalyses} {totalAnalyses === 1 ? 'analysis' : 'analyses'} across{' '}
              {groups.length} {groups.length === 1 ? 'dataset' : 'datasets'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing || isLoading}
            title="Refresh list"
            className="p-2 text-muted hover:text-ink hover:bg-black/5 rounded-lg transition-colors disabled:opacity-40"
          >
            <svg
              className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <Link
            to="/upload"
            className="px-4 py-2 bg-accent hover:bg-black text-white text-sm font-semibold rounded-xl transition-colors"
          >
            + New Analysis
          </Link>
        </div>
      </div>

      {/* Delete error banner */}
      {deleteError && (
        <div
          role="alert"
          className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center justify-between"
        >
          {deleteError}
          <button
            type="button"
            onClick={() => setDeleteError('')}
            className="ml-3 text-red-500 hover:text-red-700"
          >
            ✕
          </button>
        </div>
      )}

      {/* Full-screen loading (no cache) */}
      {isLoading && <PageLoader label="Loading your analyses…" />}

      {/* Fetch error (no cache to fall back on) */}
      {!isLoading && error && (
        <div role="alert" className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && groups.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
          <div className="w-14 h-14 bg-black/5 rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-ink font-display font-bold mb-1">No analyses yet</p>
          <p className="text-muted text-sm mb-5">Upload a dataset to generate your first AI-powered insights.</p>
          <Link to="/upload"
            className="px-5 py-2 bg-accent hover:bg-black text-white text-sm font-semibold rounded-xl transition-colors">
            Upload a dataset
          </Link>
        </div>
      )}

      {/* Groups */}
      {!isLoading && !error && groups.length > 0 && (
        <div className="space-y-10">
          {groups.map((items) => {
            const groupName = items[0].datasetName
            const hasMultipleRuns = items.length > 1
            return (
              <section key={items[0].analysisId}>
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-sm font-semibold text-body truncate" title={groupName}>
                    {groupName}
                  </h2>
                  {hasMultipleRuns && (
                    <span className="shrink-0 text-xs text-muted bg-black/5 px-2 py-0.5 rounded-full">
                      {items.length} runs
                    </span>
                  )}
                  <div className="flex-1 h-px bg-line" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((analysis, idx) => (
                    <div
                      key={analysis.analysisId}
                      className="animate-fade-in-up"
                      style={{ animationDelay: `${Math.min(idx * 60, 360)}ms` }}
                    >
                      <AnalysisCard
                        analysis={analysis}
                        onChat={handleChat}
                        onDashboard={handleDashboard}
                        onDelete={handleDelete}
                        loadingId={loadingId}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
