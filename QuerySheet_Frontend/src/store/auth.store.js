import { create } from 'zustand'

const useAuthStore = create((set, get) => ({
  user: null,
  idToken: null,
  isLoading: true,

  setUser: (user, token) =>
    set({ user, idToken: token, isLoading: false }),

  setLoading: (bool) => set({ isLoading: bool }),

  clearUser: () =>
    set({ user: null, idToken: null, isLoading: false }),

  /**
   * Returns a valid Firebase ID token, refreshing if necessary.
   * Tries the cached token first; on any failure forces a refresh;
   * on a second failure clears the user and returns null.
   */
  getIdToken: async () => {
    const { user } = get()
    if (!user) return null
    try {
      const token = await user.getIdToken(false)
      set({ idToken: token })
      return token
    } catch {
      try {
        const token = await user.getIdToken(true)
        set({ idToken: token })
        return token
      } catch {
        get().clearUser()
        return null
      }
    }
  },
}))

// ------- Selectors (use with useAuthStore(selectX)) -------

export const selectUser = (s) => s.user
export const selectIdToken = (s) => s.idToken
export const selectIsLoading = (s) => s.isLoading

export const selectIsAuthenticated = (s) =>
  s.user !== null && s.idToken !== null

/**
 * One-shot status selector — returns a primitive so subscribers don't
 * re-render unless the boolean status itself changes.
 *   'loading' | 'authed' | 'anon'
 */
export const selectAuthStatus = (s) =>
  s.isLoading
    ? 'loading'
    : s.user !== null && s.idToken !== null
    ? 'authed'
    : 'anon'

export default useAuthStore
