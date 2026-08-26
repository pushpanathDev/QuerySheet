import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../api/auth.api";
import { Spinner } from "../components/common/Loader";
import AuthBrandPanel from "../components/auth/AuthBrandPanel";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setIsSubmitting(true);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch {
      // Show a generic message — do not reveal whether the email exists.
      setError("Something went wrong. Please try again.");
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
        headline="Reset your password."
        subtitle="We'll send a secure link to your inbox so you can choose a new password."
      />

      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[400px] animate-fade-in-up">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <span className="w-2.5 h-2.5 rounded-full bg-brand" />
            <span className="font-display font-bold text-xl text-ink tracking-tight">
              QuerySheet
            </span>
          </div>

          {sent ? (
            /* Success state */
            <div className="text-center">
              <div className="mx-auto mb-5 w-14 h-14 bg-brand-soft rounded-2xl flex items-center justify-center">
                <svg
                  className="w-7 h-7 text-brand"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h2 className="font-display font-bold text-2xl text-ink">
                Check your inbox
              </h2>
              <p className="mt-2 text-sm text-body">
                If an account exists for{" "}
                <span className="font-medium text-ink">{email}</span>, you'll
                receive a password reset link shortly.
              </p>
              <p className="mt-4 text-xs text-muted">
                Didn't get it? Check your spam folder or{" "}
                <button
                  type="button"
                  onClick={() => {
                    setSent(false);
                    setEmail("");
                  }}
                  className="text-brand hover:text-brand/80 font-medium"
                >
                  try again
                </button>
                .
              </p>
              <Link
                to="/login"
                className="mt-6 inline-block text-sm font-medium text-body hover:text-ink"
              >
                ← Back to sign in
              </Link>
            </div>
          ) : (
            /* Form state */
            <>
              <h2 className="font-display font-bold text-2xl text-ink">
                Forgot your password?
              </h2>
              <p className="mt-1.5 text-sm text-body">
                Enter your account email and we'll send you a reset link.
              </p>

              <form
                onSubmit={handleSubmit}
                noValidate
                className="mt-8 space-y-4"
              >
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
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 bg-accent hover:bg-black text-white text-sm font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/40 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Spinner size="sm" tone="white" />}
                  Send reset link
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-body">
                Remember your password?{" "}
                <Link
                  to="/login"
                  className="font-medium text-brand hover:text-brand/80 underline-offset-2 hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
