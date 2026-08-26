import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import useAuth from "./hooks/useAuth";
import useAuthStore, { selectAuthStatus } from "./store/auth.store";
import ProtectedRoute from "./components/common/ProtectedRoute";
import ErrorBoundary from "./components/common/ErrorBoundary";
import AppLayout from "./components/common/AppLayout";
import LoginPage from "./pages/Login.page";
import RegisterPage from "./pages/Register.page";
import ForgotPasswordPage from "./pages/ForgotPassword.page";
import ResetPasswordPage from "./pages/ResetPassword.page";
import DashboardPage from "./pages/Dashboard.page";
import UploadPage from "./pages/Upload.page";
import ChatPage from "./pages/Chat.page";
import HistoryPage from "./pages/History.page";

function NotFoundPage() {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center text-center px-4">
      <div className="w-16 h-16 bg-black/5 rounded-2xl flex items-center justify-center mb-5">
        <svg className="w-8 h-8 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h1 className="font-display font-bold text-3xl text-ink mb-2">404 — Page not found</h1>
      <p className="text-sm text-body mb-6">The page you're looking for doesn't exist or was moved.</p>
      <Link
        to="/"
        className="px-5 py-2.5 bg-accent hover:bg-black text-white text-sm font-semibold rounded-xl transition-colors"
      >
        Go home
      </Link>
    </div>
  )
}

function RootRedirect() {
  const status = useAuthStore(selectAuthStatus);
  if (status === "loading") return null;
  return <Navigate to={status === "authed" ? "/dashboard" : "/login"} replace />;
}

function PublicOnlyRoute({ children }) {
  const status = useAuthStore(selectAuthStatus);
  if (status === "loading") return null;
  return status === "authed" ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  useAuth();

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />

          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <ErrorBoundary>
                  <LoginPage />
                </ErrorBoundary>
              </PublicOnlyRoute>
            }
          />

          <Route
            path="/register"
            element={
              <PublicOnlyRoute>
                <ErrorBoundary>
                  <RegisterPage />
                </ErrorBoundary>
              </PublicOnlyRoute>
            }
          />

          <Route
            path="/forgot-password"
            element={
              <PublicOnlyRoute>
                <ErrorBoundary>
                  <ForgotPasswordPage />
                </ErrorBoundary>
              </PublicOnlyRoute>
            }
          />

          <Route
            path="/reset-password"
            element={
              <ErrorBoundary>
                <ResetPasswordPage />
              </ErrorBoundary>
            }
          />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route
                path="/dashboard"
                element={
                  <ErrorBoundary>
                    <DashboardPage />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/upload"
                element={
                  <ErrorBoundary>
                    <UploadPage />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/history"
                element={
                  <ErrorBoundary>
                    <HistoryPage />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/chat"
                element={
                  <ErrorBoundary>
                    <ChatPage />
                  </ErrorBoundary>
                }
              />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
