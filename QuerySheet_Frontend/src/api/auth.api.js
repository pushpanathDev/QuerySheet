import apiClient from './client'

/**
 * Authenticates via email/password through the backend, which verifies
 * credentials, creates the server-side session, and sets the httpOnly cookie.
 * We do NOT call Firebase email auth directly so the backend controls sessions.
 */
export async function loginWithEmailPassword(email, password) {
  const { data } = await apiClient.post('/auth/login', { email, password })
  return data
}

export async function registerUser(email, password, displayName) {
  const { data } = await apiClient.post('/auth/register', {
    email,
    password,
    displayName,
  })
  return data
}

export async function logoutUser() {
  const { data } = await apiClient.post('/auth/logout')
  return data
}

/**
 * Triggers a password reset email for the given address.
 * The backend always returns success to avoid user enumeration.
 */
export async function forgotPassword(email) {
  const { data } = await apiClient.post('/auth/forgot-password', { email })
  return data
}

/**
 * Completes password reset using the 64-char hex token from the email link.
 * On success the backend invalidates all existing sessions — the user must log in again.
 */
export async function resetPassword(token, newPassword) {
  const { data } = await apiClient.post('/auth/reset-password', { token, newPassword })
  return data
}
