// Severity → visual treatment. `accent` colours the rail + icon chip.
const SEVERITY = {
  high:   { chip: 'bg-red-50 text-red-700 border-red-200',       rail: 'bg-red-500',    dot: 'bg-red-500' },
  medium: { chip: 'bg-amber-50 text-amber-700 border-amber-200', rail: 'bg-amber-500',  dot: 'bg-amber-500' },
  low:    { chip: 'bg-brand-soft text-brand border-brand/30',    rail: 'bg-brand',      dot: 'bg-brand' },
  info:   { chip: 'bg-black/5 text-body border-line',            rail: 'bg-muted',      dot: 'bg-muted' },
}

// Gemini returns "critical" / "warning" / "info"; map to frontend badge vocabulary.
const SEVERITY_NORMALIZE = {
  critical: 'high',
  warning:  'medium',
  info:     'low',
}

const TYPE_LABELS = {
  anomaly:        'Anomaly',
  trend:          'Trend',
  correlation:    'Correlation',
  recommendation: 'Recommendation',
  summary:        'Summary',
}

function TypeIcon({ type, className }) {
  const common = { className, fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }
  switch (type) {
    case 'trend':
      return (
        <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 17l6-6 4 4 8-8m0 0h-5m5 0v5" /></svg>
      )
    case 'anomaly':
      return (
        <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
      )
    case 'correlation':
      return (
        <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
      )
    case 'recommendation':
      return (
        <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 21h6M10 21v-3.5a5.5 5.5 0 11 4 0V21M12 3v1" /></svg>
      )
    default:
      return (
        <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      )
  }
}

/**
 * Assistant-generated insight card.
 * Left rail + chip are coloured by normalised severity; a type icon and label
 * give quick scannability. Hover lifts the card for a touch of motion.
 */
export default function InsightCard({ insight }) {
  const raw      = insight.severity?.toLowerCase() ?? 'info'
  const severity = SEVERITY_NORMALIZE[raw] ?? raw
  const type     = insight.type?.toLowerCase() ?? 'info'
  const s        = SEVERITY[severity] ?? SEVERITY.info

  return (
    <div className="group relative bg-white border border-line rounded-2xl overflow-hidden shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 h-full">
      {/* Severity rail */}
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${s.rail}`} />

      <div className="p-5 pl-6 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border ${s.chip}`}>
            <TypeIcon type={type} className="w-4 h-4" />
          </span>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${s.chip}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {severity.charAt(0).toUpperCase() + severity.slice(1)}
          </span>
          <span className="text-xs text-muted font-medium uppercase tracking-wide">
            {TYPE_LABELS[type] ?? type}
          </span>
        </div>

        <h3 className="font-display font-bold text-ink text-sm leading-snug">
          {insight.title}
        </h3>
        {insight.description && (
          <p className="text-sm text-body leading-relaxed">{insight.description}</p>
        )}
      </div>
    </div>
  )
}
