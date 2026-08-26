import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import FileDropZone from '../components/upload/FileDropZone'
import { parseFile } from '../utils/fileParser.util'
import { submitAnalysis } from '../api/analyze.api'
import useAnalysisStore from '../store/analysis.store'
import { log } from '../utils/logger.util'
import { Spinner, AnalysisLoader } from '../components/common/Loader'

const uploadLog = log.scope('Upload')

const STEPS = ['Upload File', 'Preview Data', 'Analyze']

function StepIndicator({ currentStep }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((label, idx) => {
        const stepNum = idx + 1
        const isActive = stepNum === currentStep
        const isDone = stepNum < currentStep
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={[
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors',
                  isActive || isDone
                    ? 'border-accent bg-accent text-white'
                    : 'border-line bg-white text-muted',
                ].join(' ')}
              >
                {isDone ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  stepNum
                )}
              </div>
              <span
                className={`mt-1 text-xs font-medium ${isActive || isDone ? 'text-ink' : 'text-muted'}`}
              >
                {label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`w-16 h-0.5 mb-5 mx-1 ${isDone ? 'bg-accent' : 'bg-line'}`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function ParsePreview({ rows, headers }) {
  const preview = rows.slice(0, 10)
  return (
    <div className="overflow-auto rounded-xl border border-line max-h-72">
      <table className="min-w-full text-xs">
        <thead className="bg-surface sticky top-0">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="px-3 py-2 text-left font-semibold text-body whitespace-nowrap border-b border-line"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {preview.map((row, i) => (
            <tr key={i} className="hover:bg-surface">
              {headers.map((h) => (
                <td
                  key={h}
                  className="px-3 py-2 text-body whitespace-nowrap max-w-[180px] truncate"
                  title={String(row[h] ?? '')}
                >
                  {row[h] === null || row[h] === undefined ? (
                    <span className="text-muted/60 italic">null</span>
                  ) : (
                    String(row[h])
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function UploadPage() {
  const navigate = useNavigate()
  const setAnalysis       = useAnalysisStore((s) => s.setAnalysis)
  const invalidateHistory = useAnalysisStore((s) => s.invalidateHistory)

  const [step, setStep] = useState(1)
  const [file, setFile] = useState(null)
  const [parsedData, setParsedData] = useState(null)
  const [parseError, setParseError] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleFile = useCallback((f) => {
    setFile(f)
    setParsedData(null)
    setParseError('')
  }, [])

  async function handleNext() {
    if (step === 1) {
      if (!file) return
      setIsParsing(true)
      setParseError('')
      try {
        const result = await parseFile(file)
        if (result.rows.length === 0) {
          setParseError('The file appears to be empty or has no valid rows.')
          return
        }
        setParsedData(result)
        setStep(2)
      } catch (err) {
        setParseError(err.message || 'Failed to parse file.')
      } finally {
        setIsParsing(false)
      }
      return
    }
    if (step === 2) {
      setStep(3)
    }
  }

  async function handleAnalyze() {
    if (!parsedData) return
    setIsSubmitting(true)
    setSubmitError('')

    try {
      const payload = {
        datasetName: file.name.replace(/\.[^.]+$/, ''),
        sheets: parsedData.sheets,
        // Back-compat fields for older backend versions that haven't yet
        // adopted the multi-sheet payload. Safe to remove once backend
        // requires `sheets`.
        rows: parsedData.rows,
        headers: parsedData.headers,
      }
      uploadLog.info('analyzing', {
        datasetName: payload.datasetName,
        sheetCount: payload.sheets.length,
        sheets: payload.sheets.map((s) => ({
          name: s.name,
          rowCount: s.rows.length,
          headerCount: s.headers.length,
        })),
      })

      const result = await submitAnalysis(payload)
      setAnalysis(result)
      // New analysis now exists in Firestore — mark history cache as stale so
      // the next History page mount re-fetches and shows the new entry.
      invalidateHistory()
      // The Dashboard's poller continues the live "analyzing" experience.
      navigate('/dashboard')
    } catch (err) {
      uploadLog.error('analyze failed:', err.code, err.message, err.detail ?? '')
      // err is an ApiError; map a few well-known codes for friendlier copy.
      // For validation errors (422) show the backend's own message so the user
      // (and developer) can see exactly which field/rule was rejected.
      const message =
        err.code === 'NETWORK'
          ? 'Could not reach the server. Check your connection and try again.'
          : err.code === 'TIMEOUT'
          ? 'The analysis took too long. Try a smaller dataset.'
          : err.status === 422
          ? `Validation error: ${err.message}${err.detail ? ` — ${typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail)}` : ''}`
          : 'Analysis failed. Please try again.'
      setSubmitError(message)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-surface flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl bg-white border border-line shadow-sm rounded-2xl p-8 animate-fade-in-up">
        <StepIndicator currentStep={step} />

        {/* Step 1 */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-display font-bold text-ink">Upload your dataset</h2>
              <p className="text-sm text-body mt-1">
                Supported formats: CSV, Excel (.xlsx). Maximum file size: 5 MB.
              </p>
            </div>
            <FileDropZone onFile={handleFile} />
            {parseError && (
              <p role="alert" className="text-sm text-red-600">{parseError}</p>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleNext}
                disabled={!file || isParsing}
                className="px-6 py-2.5 bg-accent hover:bg-black text-white text-sm font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isParsing && <Spinner size="sm" tone="white" />}
                {isParsing ? 'Parsing…' : 'Next →'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && parsedData && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-display font-bold text-ink">Preview parsed data</h2>
              <p className="text-sm text-body mt-1">
                Showing first 10 of{' '}
                <span className="font-semibold text-ink">{parsedData.rows.length}</span>{' '}
                rows · {parsedData.headers.length} columns detected
                {parsedData.sheets?.length > 1 && (
                  <>
                    {' · '}
                    <span className="font-semibold text-ink">
                      {parsedData.sheets.length} sheets
                    </span>{' '}
                    ({parsedData.sheets.map((s) => s.name).join(', ')})
                  </>
                )}
              </p>
            </div>
            <ParsePreview rows={parsedData.rows} headers={parsedData.headers} />
            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-6 py-2.5 text-sm font-medium text-body border border-line rounded-xl hover:bg-black/5 hover:text-ink transition-colors"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="px-6 py-2.5 bg-accent hover:bg-black text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && parsedData && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-display font-bold text-ink">Ready to analyze</h2>
              <p className="text-sm text-body mt-1">
                Review your dataset summary, then click{' '}
                <span className="font-medium text-ink">Analyze with AI</span>.
              </p>
            </div>

            {isSubmitting ? (
              <AnalysisLoader />
            ) : (
              <>
                <div className="bg-surface border border-line rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Dataset name</span>
                    <span className="font-semibold text-ink">{file.name}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Total rows</span>
                    <span className="font-semibold text-ink">{parsedData.rows.length.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Columns detected</span>
                    <span className="font-semibold text-ink">{parsedData.headers.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">File size</span>
                    <span className="font-semibold text-ink">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                </div>

                {submitError && (
                  <p role="alert" className="text-sm text-red-600">{submitError}</p>
                )}

                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-6 py-2.5 text-sm font-medium text-body border border-line rounded-xl hover:bg-black/5 hover:text-ink transition-colors"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={handleAnalyze}
                    className="px-6 py-2.5 bg-brand hover:bg-brand/90 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2"
                  >
                    ✦ Analyze with AI
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
