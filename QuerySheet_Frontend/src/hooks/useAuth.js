import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../lib/firebase.client'
import useAuthStore from '../store/auth.store'
import useAnalysisStore from '../store/analysis.store'

/**
 * Registers the Firebase auth state listener. Must be called ONCE in App.jsx.
 * The onAuthStateChanged callback fires immediately on mount with the current
 * auth state, restoring the session after a page refresh without a login flash.
 *
 * Analysis store cleanup rules (prevents stale data from leaking between users):
 *   - Sign-out   → always wipe the analysis store.
 *   - UID change → a different account signed in within the same session; wipe
 *                  before calling setUser so the new user never sees the old data.
 *   - Same UID   → page refresh / token auto-refresh; keep existing store data.
 */
export default function useAuth() {
  const setUser = useAuthStore((s) => s.setUser)
  const clearUser = useAuthStore((s) => s.clearUser)

  useEffect(() => {
    // Track the UID from the last callback so we can detect account switches.
    let prevUid = null

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        if (prevUid !== null && prevUid !== firebaseUser.uid) {
          // A different account signed in — clear the previous user's persisted
          // analysis data and history cache before the new session is established.
          useAnalysisStore.getState().clearAnalysis()
          useAnalysisStore.getState().clearHistory()
        }
        prevUid = firebaseUser.uid
        const token = await firebaseUser.getIdToken()
        setUser(firebaseUser, token)
      } else {
        // Signed out — wipe analysis data and history cache so the next user
        // (or a fresh sign-in by the same user) always starts with a clean store.
        useAnalysisStore.getState().clearAnalysis()
        useAnalysisStore.getState().clearHistory()
        prevUid = null
        clearUser()
      }
    })

    return unsubscribe
  }, [])
}
