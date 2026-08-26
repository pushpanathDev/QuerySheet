import { useEffect, useRef, useState } from 'react'
import useAnalysisStore from '../store/analysis.store'
import { getAnalysis } from '../api/analyze.api'
import { log } from '../utils/logger.util'

const pollerLog = log.scope('useAnalysisPoller')

/** How often to hit GET /analyze/:id while the backend is processing. */
const POLL_INTERVAL_MS = 4_000
/** Stop after this many attempts (~2 min) and surface a timeout state. */
const MAX_ATTEMPTS = 30

/**
 * Polls GET /analyze/:id while analysis.status === "processing".
 * When the backend returns a completed status, it calls setAnalysis() so
 * every Dashboard subscriber re-renders automatically.
 *
 * @returns {{ isPolling: boolean, timedOut: boolean }}
 */
export function useAnalysisPoller() {
  const analysisId        = useAnalysisStore((s) => s.analysisId)
  const status            = useAnalysisStore((s) => s.status)
  const setAnalysis       = useAnalysisStore((s) => s.setAnalysis)
  const invalidateHistory = useAnalysisStore((s) => s.invalidateHistory)

  const [timedOut, setTimedOut] = useState(false)
  const attemptsRef = useRef(0)

  useEffect(() => {
    if (!analysisId || status !== 'processing') {
      setTimedOut(false)
      return
    }

    attemptsRef.current = 0
    setTimedOut(false)
    pollerLog.info('started — analysisId:', analysisId)

    const timerId = setInterval(async () => {
      attemptsRef.current++

      if (attemptsRef.current > MAX_ATTEMPTS) {
        pollerLog.warn('max attempts reached — stopping poller')
        setTimedOut(true)
        clearInterval(timerId)
        return
      }

      try {
        const result = await getAnalysis(analysisId)
        pollerLog.info(`attempt ${attemptsRef.current}: status = ${result.status}`)

        if (result.status !== 'processing') {
          clearInterval(timerId)
          setAnalysis(result)
          // Analysis transitioned from "processing" → completed/failed.
          // The history list entry's status, insightsCount, chartData etc.
          // are now stale — invalidate so the next History mount re-fetches.
          invalidateHistory()
          pollerLog.info('analysis ready — store updated, history invalidated')
        }
      } catch (err) {
        // Keep retrying on transient failures; MAX_ATTEMPTS is the circuit-breaker.
        pollerLog.error('poll request failed:', err.message)
      }
    }, POLL_INTERVAL_MS)

    return () => {
      pollerLog.info('cleanup — stopping poller')
      clearInterval(timerId)
    }
  }, [analysisId, status, setAnalysis, invalidateHistory])

  return {
    isPolling: status === 'processing' && !timedOut,
    timedOut,
  }
}
