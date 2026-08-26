import { initializeApp, getApps, getApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  browserSessionPersistence,
  setPersistence,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
export const auth = getAuth(app)

// Use session-only persistence: auth state lives in sessionStorage and is
// automatically discarded when the browser tab (or browser) is closed.
// Firebase's default (browserLocalPersistence) uses IndexedDB/localStorage and
// survives full browser restarts — not the behaviour we want for this app.
// The call is fire-and-forget; a failure falls back to the default and is
// non-fatal for the application.
setPersistence(auth, browserSessionPersistence).catch(() => {})

const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider)
}

export async function signInWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password)
}

/**
 * Bridges the backend session to the Firebase client SDK using the one-time
 * custom token returned by /auth/login and /auth/register.
 * Calling this fires onAuthStateChanged → useAuth updates the store →
 * PublicOnlyRoute redirects to /dashboard automatically.
 */
export async function signInWithToken(customToken) {
  return signInWithCustomToken(auth, customToken)
}

export async function registerWithEmail(email, password) {
  return createUserWithEmailAndPassword(auth, email, password)
}

export async function signOut() {
  return firebaseSignOut(auth)
}
