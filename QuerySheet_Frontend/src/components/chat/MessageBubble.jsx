import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ---- Tailwind class overrides for markdown elements ----
// We don't use @tailwindcss/typography, so each element gets explicit styling
// to keep prose readable inside a chat bubble.
const mdComponents = {
  p: (props) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
  ul: (props) => <ul className="list-disc pl-5 mb-2 space-y-1" {...props} />,
  ol: (props) => <ol className="list-decimal pl-5 mb-2 space-y-1" {...props} />,
  li: (props) => <li className="leading-relaxed" {...props} />,
  strong: (props) => <strong className="font-semibold" {...props} />,
  em: (props) => <em className="italic" {...props} />,
  h1: (props) => <h1 className="text-base font-bold mt-2 mb-1" {...props} />,
  h2: (props) => <h2 className="text-sm font-bold mt-2 mb-1" {...props} />,
  h3: (props) => <h3 className="text-sm font-semibold mt-2 mb-1" {...props} />,
  a: (props) => (
    <a
      className="text-blue-600 underline underline-offset-2 hover:text-blue-700 break-all"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  blockquote: (props) => (
    <blockquote
      className="border-l-4 border-gray-300 pl-3 py-0.5 italic text-gray-600 my-2"
      {...props}
    />
  ),
  code: ({ inline, className, children, ...props }) => {
    if (inline) {
      return (
        <code
          className="px-1 py-0.5 rounded bg-gray-200 text-gray-800 text-[0.85em] font-mono break-words"
          {...props}
        >
          {children}
        </code>
      )
    }
    return (
      <code className={`block font-mono text-xs ${className || ''}`} {...props}>
        {children}
      </code>
    )
  },
  pre: (props) => (
    <pre
      className="my-2 p-3 rounded-lg bg-gray-900 text-gray-100 overflow-x-auto text-xs leading-relaxed"
      {...props}
    />
  ),
  table: (props) => (
    <div className="my-2 overflow-x-auto">
      <table className="min-w-full border-collapse text-xs" {...props} />
    </div>
  ),
  thead: (props) => <thead className="bg-gray-50" {...props} />,
  th: (props) => (
    <th
      className="border border-gray-300 px-2 py-1 text-left font-semibold"
      {...props}
    />
  ),
  td: (props) => <td className="border border-gray-300 px-2 py-1" {...props} />,
  hr: () => <hr className="my-3 border-gray-200" />,
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked — silently ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copy message"
      className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-[10px] font-medium text-gray-400 hover:text-gray-700 inline-flex items-center gap-1"
    >
      {copied ? (
        <>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy
        </>
      )}
    </button>
  )
}

/**
 * User messages: right-aligned, blue bubble, plain text.
 * Assistant messages: left-aligned, gray bubble, markdown-rendered, with a hover Copy button.
 * A blinking caret is appended while `isStreaming` is true.
 */
export default function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  const text = message.content ?? ''

  return (
    <div
      className={`group flex items-end gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white mb-1">
          AI
        </div>
      )}

      <div className={`flex flex-col gap-1 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={[
            'px-4 py-3 text-sm leading-relaxed break-words',
            isUser
              ? 'bg-blue-600 text-white rounded-xl rounded-tr-none whitespace-pre-wrap'
              : 'bg-gray-100 text-gray-800 rounded-xl rounded-tl-none',
          ].join(' ')}
        >
          {isUser ? (
            text
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {text}
            </ReactMarkdown>
          )}
          {message.isStreaming && (
            <span
              className={`inline-block w-1.5 h-4 ml-0.5 align-middle animate-pulse ${
                isUser ? 'bg-white/80' : 'bg-gray-500'
              }`}
            />
          )}
        </div>

        <div className="flex items-center gap-2 px-1 h-3.5">
          <span className="text-[10px] text-gray-400">
            {formatTime(message.timestamp)}
          </span>
          {!isUser && !message.isStreaming && text && <CopyButton text={text} />}
        </div>
      </div>

      {isUser && (
        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-gray-600 mb-1">
          You
        </div>
      )}
    </div>
  )
}
