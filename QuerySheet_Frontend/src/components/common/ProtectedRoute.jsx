import { Navigate, Outlet } from "react-router-dom";
import useAuthStore, { selectAuthStatus } from "../../store/auth.store";

function FullScreenSpinner() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-surface z-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-[3px] border-ink/20 border-t-ink rounded-full animate-spin" />
        <p className="text-sm text-muted font-medium">Restoring session…</p>
      </div>
    </div>
  );
}

/**
 * Guards all protected routes. Reads auth state from Zustand — no prop-drilling.
 * While the listener is restoring auth state on page refresh, a full-screen
 * spinner is shown to prevent a premature redirect to /login.
 */
export default function ProtectedRoute() {
  const status = useAuthStore(selectAuthStatus);

  if (status === "loading") return <FullScreenSpinner />;
  if (status !== "authed") return <Navigate to="/login" replace />;

  return <Outlet />;
}
