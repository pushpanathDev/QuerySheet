import { useState } from "react";
import { Link } from "react-router-dom";
import { signInWithGoogle, signInWithToken } from "../lib/firebase.client";
import { loginWithEmailPassword } from "../api/auth.api";
import { Spinner } from "../components/common/Loader";
import AuthBrandPanel from "../components/auth/AuthBrandPanel";

const ERROR_MAP = {
  "auth/user-not-found": "No account found with this email address.",
  "auth/wrong-password": "Incorrect password. Please try again.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/too-many-requests":
    "Too many failed attempts. Account temporarily locked.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/invalid-email": "Please enter a valid email address.",
  ACCOUNT_LOCKED: null,
};

function formatLockoutError(detail) {
  if (detail?.remainingSeconds) {
    const mins = Math.ceil(detail.remainingSeconds / 60);
    return `Account is locked. Try again in ${mins} minute${mins !== 1 ? "s" : ""}.`;
  }
  return "Account is temporarily locked due to too many failed attempts.";
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  async function handleGoogleSignIn() {
    setError("");
    setIsGoogleLoading(true);
    try {
      await signInWithGoogle();
      // onAuthStateChanged in useAuth will update the store and trigger redirect
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") {
        setError(
          ERROR_MAP[err.code] ?? "Google sign-in failed. Please try again.",
        );
      }
    } finally {
      setIsGoogleLoading(false);
    }
  }

  async function handleEmailSignIn(e) {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Step 1: backend validates credentials, writes the httpOnly session cookie,
      // and returns a one-time Firebase custom token.
      const { firebaseCustomToken } = await loginWithEmailPassword(
        email.trim(),
        password,
      );

      // Step 2: exchange the custom token for a live Firebase client session.
      // This fires onAuthStateChanged → useAuth updates the store →
      // PublicOnlyRoute redirects to /dashboard automatically.
      await signInWithToken(firebaseCustomToken);
    } catch (err) {
      const code = err.code;
      const detail = err.detail;

      if (code === "ACCOUNT_LOCKED") {
        setError(formatLockoutError(detail));
      } else {
        setError(ERROR_MAP[code] ?? "Sign-in failed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass =
    "w-full px-3.5 py-2.5 border border-line rounded-xl text-sm text-ink placeholder-muted " +
    "focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition bg-white";

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-surface">
      <AuthBrandPanel
        headline="Transform data into decisions."
        subtitle="Upload your information and get powerful insights right away. Work smarter and achieve goals effortlessly."
      />

      {/* Form side */}
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[400px] animate-fade-in-up">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <span className="w-2.5 h-2.5 rounded-full bg-brand" />
            <span className="font-display font-bold text-xl text-ink tracking-tight">
              QuerySheet
            </span>
          </div>

          <h2 className="font-display font-bold text-2xl text-ink">
            Welcome back
          </h2>
          <p className="mt-1.5 text-sm text-body">
            Sign in to continue to your dashboard.
          </p>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || isSubmitting}
            className="mt-7 w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white border border-line rounded-xl text-sm font-medium text-ink hover:bg-black/[0.03] focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isGoogleLoading ? (
              <Spinner size="sm" tone="ink" />
            ) : (
              <GoogleIcon />
            )}
            Continue with Google
          </button>

          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-line" />
            <span className="text-xs text-muted font-medium uppercase tracking-wide">
              or
            </span>
            <div className="flex-1 h-px bg-line" />
          </div>

          <form onSubmit={handleEmailSignIn} noValidate className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-ink mb-1.5"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@company.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-ink"
                >
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-brand hover:text-brand/80 underline-offset-2 hover:underline"
                  tabIndex={-1}
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700"
              >
                <svg
                  className="w-4 h-4 mt-0.5 shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || isGoogleLoading}
              className="w-full py-2.5 px-4 bg-accent hover:bg-black text-white text-sm font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/40 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting && <Spinner size="sm" tone="white" />}
              Sign In
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-body">
            Don&apos;t have an account?{" "}
            <Link
              to="/register"
              className="font-medium text-brand hover:text-brand/80 underline-offset-2 hover:underline"
            >
              Create account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
