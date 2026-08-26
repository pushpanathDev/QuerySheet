/**
 * Three bouncing dots shown while awaiting an assistant response.
 * Animation is driven by the dot-bounce keyframe defined in index.css.
 */
export default function TypingIndicator() {
  return (
    <div className="flex items-start gap-2">
      <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white">
        AI
      </div>
      <div className="bg-white border border-line shadow-sm rounded-xl rounded-tl-none px-4 py-3 flex items-center gap-1.5">
        <span className="w-2 h-2 bg-brand rounded-full dot-bounce" />
        <span className="w-2 h-2 bg-brand rounded-full dot-bounce" />
        <span className="w-2 h-2 bg-brand rounded-full dot-bounce" />
      </div>
    </div>
  )
}
