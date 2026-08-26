import { useEffect, useState } from 'react'

const SIZES = {
  xs: 'w-3 h-3 border-2',
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-[3px]',
}

const TONES = {
  ink: 'border-ink/25 border-t-ink',
  brand: 'border-brand/25 border-t-brand',
  white: 'border-white/40 border-t-white',
  muted: 'border-muted/30 border-t-muted',
}

/**
 * Inline spinner. Use inside buttons or beside text.
 * @param {{ size?: 'xs'|'sm'|'md'|'lg', tone?: 'ink'|'brand'|'white'|'muted', className?: string }} props
 */
export function Spinner({ size = 'sm', tone = 'ink', className = '' }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block rounded-full animate-spin ${SIZES[size]} ${TONES[tone]} ${className}`}
    />
  )
}

/**
 * Centered loader for a whole page/section that has no cached content to show.
 */
export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 animate-fade-in">
      <Spinner size="lg" tone="ink" />
      {label && <p className="text-sm text-muted">{label}</p>}
    </div>
  )
}

const ANALYSIS_STEPS = [
  'Reading your dataset…',
  'Scanning columns & data types…',
  'Computing statistics…',
  'Detecting trends & anomalies…',
  'Generating AI insights…',
]

/**
 * Rich motion-graphic loader shown while the backend analyses a dataset.
 * Concentric pulse rings + an animated data-equalizer + rotating status copy.
 *
 * @param {{ timedOut?: boolean, children?: React.ReactNode }} props
 *   children renders in place of the rotating steps (e.g. a timeout message).
 */
export function AnalysisLoader({ timedOut = false, children }) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (timedOut) return
    const id = setInterval(() => {
      setStep((s) => (s + 1) % ANALYSIS_STEPS.length)
    }, 2200)
    return () => clearInterval(id)
  }, [timedOut])

  return (
    <div className="flex flex-col items-center justify-center text-center py-14 animate-fade-in">
      {/* Pulsing core with concentric rings */}
      <div className="relative w-24 h-24 flex items-center justify-center mb-8">
        <span className="absolute inset-0 rounded-full bg-brand/20 animate-pulse-ring" />
        <span
          className="absolute inset-0 rounded-full bg-brand/15 animate-pulse-ring"
          style={{ animationDelay: '0.6s' }}
        />
        <span
          className="absolute inset-0 rounded-full bg-brand/10 animate-pulse-ring"
          style={{ animationDelay: '1.2s' }}
        />
        <div className="relative w-16 h-16 rounded-2xl bg-accent flex items-center justify-center shadow-lg">
          {/* Animated equalizer bars */}
          <div className="flex items-end gap-1 h-7">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="w-1.5 rounded-full bg-lime"
                style={{
                  animation: 'bounce-dot 1s ease-in-out infinite',
                  animationDelay: `${i * 0.15}s`,
                  height: '100%',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {children ? (
        children
      ) : (
        <>
          <h3 className="text-lg font-display font-bold text-ink mb-2">
            Analyzing your dataset
          </h3>
          <p key={step} className="text-sm text-body animate-fade-in min-h-[20px]">
            {ANALYSIS_STEPS[step]}
          </p>

          {/* Step progress dots */}
          <div className="flex items-center gap-1.5 mt-5">
            {ANALYSIS_STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i === step ? 'w-6 bg-brand' : 'w-1.5 bg-line'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default Spinner
