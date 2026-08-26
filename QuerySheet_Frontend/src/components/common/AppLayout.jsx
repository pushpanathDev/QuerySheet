import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import useAuthStore from "../../store/auth.store";
import useAnalysisStore from "../../store/analysis.store";
import { signOut } from "../../lib/firebase.client";
import { logoutUser } from "../../api/auth.api";

function navLinkClass({ isActive }) {
  return [
    "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
    isActive
      ? "text-brand bg-brand-soft"
      : "text-body hover:text-ink hover:bg-black/5",
  ].join(" ");
}

/**
 * Shared chrome for all authenticated pages: sticky nav bar + content via <Outlet/>.
 * All protected routes (dashboard, upload, history, chat) are nested under this
 * layout in App.jsx. ChatPage uses h-[calc(100vh-3.5rem)] so its fixed input bar
 * and scrollable message list fill exactly the viewport below this nav.
 */
export default function AppLayout() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clearUser = useAuthStore((s) => s.clearUser);
  const analysisId = useAnalysisStore((s) => s.analysisId);

  async function handleSignOut() {
    // Revoke the server-side httpOnly session cookie so the backend immediately
    // rejects any request carrying it. This must happen before Firebase signOut
    // so the request interceptor can still attach a valid Bearer token.
    try {
      await logoutUser();
    } catch {
      // Non-critical — proceed with client-side sign-out regardless.
    }
    await signOut();
    clearUser();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="bg-white/90 backdrop-blur border-b border-line sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              to="/dashboard"
              className="flex items-center gap-2 text-lg font-display font-bold text-ink tracking-tight"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-brand" />
              QuerySheet
            </Link>
            <nav className="hidden sm:flex items-center gap-1">
              <NavLink to="/dashboard" className={navLinkClass}>
                Dashboard
              </NavLink>
              <NavLink to="/upload" className={navLinkClass}>
                Upload
              </NavLink>
              <NavLink to="/history" className={navLinkClass}>
                History
              </NavLink>
              {analysisId && (
                <NavLink to="/chat" className={navLinkClass}>
                  Chat
                </NavLink>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-muted truncate max-w-[180px]">
              {user?.displayName || user?.email}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              className="px-3 py-1.5 text-sm font-medium text-body border border-line rounded-lg hover:bg-black/5 hover:text-ink transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
