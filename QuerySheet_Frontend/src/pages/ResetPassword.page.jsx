import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { resetPassword } from "../api/auth.api";
import { Spinner } from "../components/common/Loader";
import AuthBrandPanel from "../components/auth/AuthBrandPanel";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  // Token is exactly 64 hex chars — validate before even trying the API.
  const tokenValid = /^[0-9a-f]{64}$/i.test(token);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword(token, newPassword);
      setDone(true);
    } catch (err) {
      const code = err?.code;
      if (code === "INVALID_TOKEN" || code === "EXPIRED_TOKEN") {
        setError(
          "This reset link is invalid or has expired. Please request a new one.",
        );
      } else {
        setError("Something went wrong. Please try again.");
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
        headline="Choose a new password."
        subtitle="Pick something strong. Your existing sessions will be signed out for security."
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

          {/* Invalid / missing token */}
          {!tokenValid && (
            <div className="text-center">
              <div className="mx-auto mb-5 w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center">
                <svg
                  className="w-7 h-7 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  />
                </svg>
              </div>
              <h2 className="font-display font-bold text-2xl text-ink">
                Invalid reset link
              </h2>
              <p className="mt-2 text-sm text-body">
                This link is missing or malformed. Please request a new password
                reset.
              </p>
              <Link
                to="/forgot-password"
                className="mt-5 inline-block px-5 py-2.5 bg-accent hover:bg-black text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Request new link
              </Link>
            </div>
          )}

          {/* Success state */}
          {tokenValid && done && (
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="font-display font-bold text-2xl text-ink">
                Password updated
              </h2>
              <p className="mt-2 text-sm text-body">
                Your password has been changed. All previous sessions have been
                signed out.
              </p>
              <button
                type="button"
                onClick={() => navigate("/login", { replace: true })}
                className="mt-6 w-full py-2.5 px-4 bg-accent hover:bg-black text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Sign in with new password
              </button>
            </div>
          )}

          {/* Form state */}
          {tokenValid && !done && (
            <>
              <h2 className="font-display font-bold text-2xl text-ink">
                Set new password
              </h2>
              <p className="mt-1.5 text-sm text-body">
                Choose a strong password for your account.
              </p>

              <form
                onSubmit={handleSubmit}
                noValidate
                className="mt-8 space-y-4"
              >
                <div>
                  <label
                    htmlFor="newPassword"
                    className="block text-sm font-medium text-ink mb-1.5"
                  >
                    New password{" "}
                    <span className="text-muted font-normal">
                      (min. 8 characters)
                    </span>
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={inputClass}
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-ink mb-1.5"
                  >
                    Confirm new password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 bg-accent hover:bg-black text-white text-sm font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/40 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Spinner size="sm" tone="white" />}
                  Reset password
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-body">
                <Link
                  to="/login"
                  className="font-medium text-brand hover:text-brand/80 underline-offset-2 hover:underline"
                >
                  ← Back to sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
