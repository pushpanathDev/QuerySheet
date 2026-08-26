import apiClient from './client'
import useAuthStore from '../store/auth.store'
import { toApiError } from './ApiError'
import { log } from '../utils/logger.util'

const chatLog = log.scope('chat.api')

/**
 * Sends a chat message tied to an analysis (non-streaming fallback).
 * @param {string} analysisId
 * @param {string} message
 * @returns {Promise<object>} { reply, ... }
 */
export async function sendChatMessage(analysisId, message) {
  const { data } = await apiClient.post('/chat', { analysisId, message })
  return data
}

/**
 * Fetches the persisted chat history for an analysis.
 * Backend returns either an array directly, or `{ history: [...] }`,
 * or (post-envelope-unwrap) the `data` field of the envelope. We
 * normalise to a plain array.
 *
 * Each history item: { role: 'user' | 'assistant', reply: string, createdAt: string, messageId?: string }
 */
export async function getChatHistory(analysisId) {
  const { data } = await apiClient.get(`/chat/history/${analysisId}`)
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.history)) return data.history
  if (Array.isArray(data?.messages)) return data.messages
  return []
}

/**
 * Streams a chat reply via Server-Sent Events.
 *
 * Backend contract (expected):
 *   GET  /chat/stream?analysisId=...&message=...
 *   Content-Type: text/event-stream
 *   Frames: `data: {"token": "..."}\n\n`   ← deltas
 *           `data: [DONE]\n\n`             ← terminator
 *
 * We use fetch + ReadableStream rather than EventSource because
 * EventSource cannot send Authorization headers.
 *
 * @param {object} params
 * @param {string} params.analysisId
 * @param {string} params.message
 * @param {AbortSignal} [params.signal]
 * @param {(chunk: string) => void} params.onToken      called for each delta
 * @param {(full: string) => void}  [params.onDone]     called when stream ends cleanly
 * @returns {Promise<string>} resolves to the full accumulated text
 */
export async function streamChatMessage({
  analysisId,
  message,
  signal,
  onToken,
  onDone,
}) {
  const baseURL = import.meta.env.VITE_API_BASE_URL
  const token = await useAuthStore.getState().getIdToken()

  const url = new URL(`${baseURL}/chat/stream`)
  url.searchParams.set('analysisId', analysisId)
  url.searchParams.set('message', message)

  let response
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal,
    })
  } catch (err) {
    throw toApiError(err)
  }

  if (!response.ok || !response.body) {
    throw toApiError({
      response: { status: response.status, data: await safeReadBody(response) },
    })
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let full = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // SSE frames are separated by a blank line (\n\n).
      const frames = buffer.split('\n\n')
      buffer = frames.pop() ?? ''

      for (const frame of frames) {
        const dataLines = frame
          .split('\n')
          .filter((l) => l.startsWith('data:'))
        if (dataLines.length === 0) continue
        const payload = dataLines.map((l) => l.slice(5).trim()).join('\n')

        if (payload === '[DONE]' || payload === 'DONE') {
          onDone?.(full)
          return full
        }

        let chunk = ''
        try {
          const parsed = JSON.parse(payload)
          chunk =
            parsed.token ??
            parsed.delta ??
            parsed.text ??
            parsed.reply ??
            parsed.content ??
            ''
          if (parsed.done) {
            if (chunk) {
              full += chunk
              onToken?.(chunk)
            }
            onDone?.(full)
            return full
          }
        } catch {
          // Plain-text SSE frame
          chunk = payload
        }

        if (chunk) {
          full += chunk
          onToken?.(chunk)
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      chatLog.info('stream aborted')
      return full
    }
    throw toApiError(err)
  }

  onDone?.(full)
  return full
}

async function safeReadBody(response) {
  try {
    const text = await response.text()
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  } catch {
    return null
  }
}
