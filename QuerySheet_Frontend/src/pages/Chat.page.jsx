import { useState, useRef, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import MessageBubble from '../components/chat/MessageBubble'
import TypingIndicator from '../components/chat/TypingIndicator'
import useAnalysisStore from '../store/analysis.store'
import {
  sendChatMessage,
  streamChatMessage,
  getChatHistory,
} from '../api/chat.api'
import { log } from '../utils/logger.util'

const chatLog = log.scope('Chat')

const MAX_CHARS = 500

const FALLBACK_REPLY = 'I could not generate a response.'

// Toggle to disable streaming if the backend SSE endpoint isn't ready.
// Streaming gracefully falls back to POST /chat on any failure anyway.
const USE_STREAMING = true

/**
 * Robustly pulls the assistant's text out of whatever shape the backend
 * returns. Handles:
 *   - { reply: "..." } / { content: "..." } / { answer: "..." } / { message: "..." } / { text: "..." }
 *   - Gemini-style { candidates:[{ content:{ parts:[{text}] } }] }
 *   - Double-encoded JSON strings, e.g. answer: '{"answer":"..."}'
 *   - Plain strings
 */
function extractAssistantText(response) {
  if (response == null) return FALLBACK_REPLY

  // Plain string — try to parse if it looks like JSON, otherwise return as-is.
  if (typeof response === 'string') {
    const trimmed = response.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return extractAssistantText(JSON.parse(trimmed))
      } catch {
        return trimmed
      }
    }
    return trimmed
  }

  if (typeof response !== 'object') return String(response)

  // Common direct fields, in priority order.
  const direct =
    response.reply ??
    response.answer ??
    response.content ??
    response.message ??
    response.text
  if (typeof direct === 'string') {
    return extractAssistantText(direct) // recurse to handle nested JSON strings
  }

  // Gemini-style candidates[0].content.parts[0].text
  const geminiText = response.candidates?.[0]?.content?.parts?.[0]?.text
  if (typeof geminiText === 'string') return geminiText.trim()

  // Last resort — log and show fallback so the user isn't shown a JSON dump.
  chatLog.warn('unrecognised reply shape, keys:', Object.keys(response))
  return FALLBACK_REPLY
}

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Hello! I've analyzed your dataset and I'm ready to answer questions. You can ask me about trends, anomalies, specific columns, or request further breakdowns.",
  timestamp: Date.now(),
}

function NoDatasetBanner() {
  return (
    <div className="mx-4 mt-4 p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-3">
      <svg
        className="w-5 h-5 text-amber-500 shrink-0 mt-0.5"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
      <div>
        <p className="text-sm font-semibold text-amber-800">No dataset loaded</p>
        <p className="text-sm text-amber-700 mt-0.5">
          <Link to="/history" className="underline font-medium hover:text-amber-900">
            Pick a past analysis
          </Link>{' '}
          or{' '}
          <Link to="/upload" className="underline font-medium hover:text-amber-900">
            upload a new dataset
          </Link>{' '}
          to start chatting.
        </p>
      </div>
    </div>
  )
}

export default function ChatPage() {
  const analysisId = useAnalysisStore((s) => s.analysisId)
  const datasetName = useAnalysisStore((s) => s.datasetName)

  const [messages, setMessages] = useState(
    analysisId ? [WELCOME_MESSAGE] : []
  )
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)
  const streamAbortRef = useRef(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading, scrollToBottom])

  // Abort any in-flight stream when the page unmounts.
  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort()
    }
  }, [])

  // Load persisted history on mount / when analysis changes.
  useEffect(() => {
    if (!analysisId) return
    let cancelled = false
    ;(async () => {
      try {
        const history = await getChatHistory(analysisId)
        if (cancelled || !Array.isArray(history) || history.length === 0) return
        const restored = history.map((m, i) => {
          const rawText = m.reply ?? m.content ?? m.message ?? m.text ?? ''
          const ts = m.createdAt
            ? new Date(m.createdAt).getTime()
            : m.timestamp ?? Date.now()
          return {
            id: m.messageId ?? m.id ?? `hist-${i}-${ts}`,
            role: m.role === 'user' ? 'user' : 'assistant',
            content:
              m.role === 'assistant'
                ? extractAssistantText(rawText)
                : typeof rawText === 'string'
                ? rawText
                : String(rawText),
            timestamp: ts,
          }
        })
        setMessages([WELCOME_MESSAGE, ...restored])
      } catch (err) {
        chatLog.warn('failed to load chat history:', err.code, err.message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [analysisId])

  function adjustTextareaHeight() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const lineHeight = 24
    const maxHeight = lineHeight * 4
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
  }

  function handleInputChange(e) {
    const val = e.target.value.slice(0, MAX_CHARS)
    setInput(val)
    adjustTextareaHeight()
  }

  async function handleSend() {
    const trimmed = input.trim()
    if (!trimmed || isLoading || !analysisId) return

    const now = Date.now()
    const userMessage = {
      id: `user-${now}`,
      role: 'user',
      content: trimmed,
      timestamp: now,
    }
    const assistantId = `assistant-${now}`
    const assistantPlaceholder = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: now,
      isStreaming: true,
    }

    setMessages((prev) => [...prev, userMessage, assistantPlaceholder])
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    setIsLoading(true)

    // Helper: replace the streaming placeholder with finalised content.
    const finalise = (content) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content, isStreaming: false }
            : m,
        ),
      )
    }

    // Helper: append a delta to the streaming placeholder.
    const appendDelta = (delta) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: (m.content || '') + delta }
            : m,
        ),
      )
    }

    const controller = new AbortController()
    streamAbortRef.current = controller

    try {
      if (USE_STREAMING) {
        const full = await streamChatMessage({
          analysisId,
          message: trimmed,
          signal: controller.signal,
          onToken: appendDelta,
        })
        // Run the final accumulated text through the extractor in case the
        // backend sent a single non-streaming JSON frame disguised as SSE.
        finalise(extractAssistantText(full) || FALLBACK_REPLY)
      } else {
        const response = await sendChatMessage(analysisId, trimmed)
        finalise(extractAssistantText(response))
      }
    } catch (err) {
      // Streaming failed → graceful fallback to POST /chat once.
      const isAbort = err?.name === 'AbortError' || err?.code === 'CANCELLED'
      if (isAbort) {
        finalise('(stopped)')
        return
      }

      chatLog.warn('stream failed, falling back to POST /chat:', err.code, err.message)
      try {
        const response = await sendChatMessage(analysisId, trimmed)
        finalise(extractAssistantText(response))
      } catch (err2) {
        chatLog.error('chat send failed:', err2.code, err2.status, err2.message)
        const content =
          err2?.code === 'NETWORK'
            ? 'I lost connection to the server. Please check your network and try again.'
            : err2?.code === 'TIMEOUT'
            ? 'The response took too long. Try a shorter question.'
            : err2?.code === 'SERVER_ERROR' || err2?.status >= 500
            ? 'The server hit an error generating that answer. Try rephrasing or asking again.'
            : 'Sorry, I encountered an error processing your request. Please try again.'
        finalise(content)
      }
    } finally {
      streamAbortRef.current = null
      setIsLoading(false)
    }
  }

  function handleStop() {
    streamAbortRef.current?.abort()
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const charCount = input.length
  const isOverLimit = charCount > MAX_CHARS
  const canSend = input.trim().length > 0 && !isLoading && !isOverLimit && Boolean(analysisId)

  return (
    // AppLayout's nav bar is h-14 (3.5rem); fill the remaining viewport height
    // so the message list and fixed input bar sit flush to the bottom.
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-gray-50">
      {/* Contextual sub-header: dataset name + AI status */}
      <header className="bg-white border-b border-gray-200 shrink-0">
        <div className="max-w-4xl mx-auto px-4 h-11 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {datasetName ? datasetName : 'Chat with your data'}
            </p>
          </div>
          <p className="text-xs text-gray-400 shrink-0 ml-3">
            {analysisId ? 'AI is ready' : 'No dataset loaded'}
          </p>
        </div>
      </header>

      {/* No dataset banner */}
      {!analysisId && <NoDatasetBanner />}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
          {messages.length === 0 && analysisId && (
            <div className="text-center text-gray-400 text-sm mt-16">
              No messages yet. Ask a question below.
            </div>
          )}
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {isLoading && !messages.some((m) => m.isStreaming) && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Fixed Input Bar */}
      <div className="shrink-0 border-t border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                disabled={!analysisId || isLoading}
                placeholder={
                  analysisId
                    ? 'Ask a question about your data… (Enter to send, Shift+Enter for new line)'
                    : 'Upload a dataset to start chatting'
                }
                rows={1}
                className={[
                  'w-full resize-none rounded-xl border px-4 py-3 pr-16 text-sm leading-6 placeholder-gray-400',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition',
                  'disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed',
                  isOverLimit ? 'border-red-400' : 'border-gray-300',
                ].join(' ')}
                style={{ maxHeight: '96px', overflowY: 'auto' }}
              />
              <span
                className={`absolute bottom-2.5 right-3 text-[10px] font-medium ${
                  isOverLimit ? 'text-red-500' : 'text-gray-400'
                }`}
              >
                {charCount}/{MAX_CHARS}
              </span>
            </div>

            <button
              type="button"
              onClick={isLoading ? handleStop : handleSend}
              disabled={!isLoading && !canSend}
              aria-label={isLoading ? 'Stop generating' : 'Send message'}
              title={isLoading ? 'Stop generating' : 'Send message'}
              className={[
                'shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
                isLoading
                  ? 'bg-gray-800 hover:bg-gray-900 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 disabled:cursor-not-allowed',
              ].join(' ')}
            >
              {isLoading ? (
                // Stop / square icon
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="3" y="3" width="10" height="10" rx="1.5" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>

          <p className="mt-1.5 text-[10px] text-gray-400 text-center">
            AI responses are based on your uploaded dataset only. Verify important decisions independently.
          </p>
        </div>
      </div>
    </div>
  )
}
