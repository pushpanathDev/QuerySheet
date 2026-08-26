/**
 * Uniform error shape for all HTTP failures. Pages should catch ApiError
 * and switch on `code` rather than poking at axios internals.
 *
 * Categories:
 *   - 'NETWORK'         : request never reached the server (offline, CORS, DNS)
 *   - 'TIMEOUT'         : axios timeout fired before a response
 *   - 'CANCELLED'       : request was aborted (e.g. component unmount)
 *   - 'SERVER_ERROR'    : 5xx response with no structured error body
 *   - <backend-code>    : whatever string the backend returned in error.code
 *                         (e.g. 'ACCOUNT_LOCKED', 'auth/wrong-password')
 *   - 'UNKNOWN'         : everything else
 */
export class ApiError extends Error {
  constructor({ status, code, message, detail, cause }) {
    super(message || code || 'Request failed')
    this.name = 'ApiError'
    this.status = status ?? null
    this.code = code ?? 'UNKNOWN'
    this.detail = detail ?? null
    this.cause = cause ?? null
  }

  is(code) {
    return this.code === code
  }
}

/**
 * Translates an axios error / server envelope into an ApiError.
 * Accepts either an axios error object or a Response with a parsed body.
 */
export function toApiError(axiosError) {
  // Cancelled request
  if (axiosError?.code === 'ERR_CANCELED' || axiosError?.name === 'CanceledError') {
    return new ApiError({
      code: 'CANCELLED',
      message: 'Request was cancelled.',
      cause: axiosError,
    })
  }

  // Timeout
  if (axiosError?.code === 'ECONNABORTED') {
    return new ApiError({
      code: 'TIMEOUT',
      message: 'The request took too long to complete.',
      cause: axiosError,
    })
  }

  const response = axiosError?.response
  // Network error — no response at all
  if (!response) {
    return new ApiError({
      code: 'NETWORK',
      message:
        axiosError?.message ||
        'Could not reach the server. Please check your connection.',
      cause: axiosError,
    })
  }

  const status = response.status
  const body = response.data

  // Backend envelope { success: false, error: { code, message, detail } }
  if (body && typeof body === 'object' && body.error) {
    return new ApiError({
      status,
      code: body.error.code || `HTTP_${status}`,
      message: body.error.message || 'Request failed',
      detail: body.error.detail ?? null,
      cause: axiosError,
    })
  }

  // 5xx with no structured body
  if (status >= 500) {
    return new ApiError({
      status,
      code: 'SERVER_ERROR',
      message: 'The server encountered an error. Please try again.',
      cause: axiosError,
    })
  }

  return new ApiError({
    status,
    code: `HTTP_${status}`,
    message: typeof body === 'string' ? body : `Request failed with status ${status}`,
    cause: axiosError,
  })
}

export default ApiError
