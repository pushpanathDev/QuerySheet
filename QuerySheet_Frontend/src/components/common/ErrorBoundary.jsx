import { Component } from 'react'
import { log } from '../../utils/logger.util'

const boundaryLog = log.scope('ErrorBoundary')

/**
 * Catches render-time errors anywhere below it. Use a top-level boundary in
 * App.jsx for catastrophic crashes and per-route boundaries for graceful
 * recovery (e.g. a broken chart shouldn't blank out the dashboard nav).
 *
 * Usage:
 *   <ErrorBoundary fallback={<MyFallback/>}> ... </ErrorBoundary>
 *   <ErrorBoundary onReset={() => refetch()}> ... </ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    boundaryLog.error('caught render error:', error, info)
    this.props.onError?.(error, info)
  }

  handleReset = () => {
    this.setState({ error: null })
    this.props.onReset?.()
  }

  render() {
    if (!this.state.error) return this.props.children

    if (this.props.fallback) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback({
          error: this.state.error,
          reset: this.handleReset,
        })
      }
      return this.props.fallback
    }

    return (
      <DefaultFallback error={this.state.error} onReset={this.handleReset} />
    )
  }
}

function DefaultFallback({ error, onReset }) {
  const isDev = import.meta.env.DEV
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white border border-red-200 rounded-2xl shadow-sm p-8 text-center">
        <div className="w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
          <svg
            className="w-6 h-6 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="text-lg font-display font-bold text-ink mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-body mb-6">
          The page hit an unexpected error. You can try again, or head back to
          the dashboard.
        </p>

        {isDev && error && (
          <details className="mb-6 text-left">
            <summary className="text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700">
              Error details (dev only)
            </summary>
            <pre className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-red-700 overflow-auto max-h-48">
              {error.stack || error.message || String(error)}
            </pre>
          </details>
        )}

        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="px-4 py-2 bg-accent hover:bg-black text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="px-4 py-2 text-sm font-medium text-body border border-line rounded-xl hover:bg-black/5 hover:text-ink transition-colors"
          >
            Go to dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
