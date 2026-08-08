import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import AppShell from "./components/AppShell";
import LanguageSwitcher from "./components/LanguageSwitcher";
import ProtectedRoute from "./components/ProtectedRoute";
import AppConsentBanner from "./components/AppConsentBanner";
import { AccountProvider, useAccountContext } from "./lib/AccountContext";
import { setUnauthorizedHandler } from "./lib/api";
import { track } from "./lib/analytics";
import { useT } from "./lib/i18n";

const Tool = lazy(() => import("./pages/Tool"));
const NewChase = lazy(() => import("./pages/NewChase"));
const Templates = lazy(() => import("./pages/Templates"));
const Login = lazy(() => import("./pages/Login"));
const Account = lazy(() => import("./pages/Account"));
const Admin = lazy(() => import("./pages/Admin"));
const Branding = lazy(() => import("./pages/Branding"));
const Webhooks = lazy(() => import("./pages/Webhooks"));
const Connector = lazy(() => import("./pages/Connector"));
const Clients = lazy(() => import("./pages/Clients"));
const Team = lazy(() => import("./pages/Team"));

function AppRoutes() {
  const t = useT();
  const { account, loading, refresh, signOut } = useAccountContext();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const isLogin = location.pathname === "/login";

  useEffect(() => {
    setUnauthorizedHandler(() => {
      // A 401 here is the normal "not signed in yet" state while already on the login page — not an
      // expired session to bounce out of. Redirecting to the page we're already on still triggers a
      // full reload, which re-fires the same 401 forever. Admin has its own password-gated login
      // (Admin.tsx) and manages its own auth state — AccountProvider's background /account/me check
      // still 401s there for a logged-out visitor, and this handler used to hijack that into the
      // regular user login before Admin's own gate ever rendered.
      if (window.location.pathname !== "/app/login" && !window.location.pathname.startsWith("/app/admin")) {
        window.location.href = "/app/login";
      }
    });
  }, []);

  useEffect(() => {
    if (!isAdmin && account) track("dashboard_loaded");
  }, [isAdmin, account]);

  if (isAdmin) {
    return (
      <Suspense fallback={<p className="page-sub">Loading…</p>}>
        <Routes>
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </Suspense>
    );
  }

  if (isLogin) {
    return (
      <div className="app-auth">
        <header className="app-topbar app-topbar-auth">
          {account ? (
            <Link to="/" className="app-topbar-brand" aria-label={t("nav.home")}>
              <img src="/brand/chasa-icon.png" alt="" width="24" height="24" />
              <span>chasa</span>
            </Link>
          ) : (
            <a href="/" className="app-topbar-brand" aria-label="Chasa home">
              <img src="/brand/chasa-icon.png" alt="" width="24" height="24" />
              <span>chasa</span>
            </a>
          )}
          <LanguageSwitcher className="lang-switcher-on-dark" />
        </header>
        <Suspense fallback={<p className="page-sub">Loading…</p>}>
          <Routes>
            <Route path="/login" element={<Login />} />
          </Routes>
        </Suspense>
      </div>
    );
  }

  return (
    <>
      <AppShell account={account} loading={loading} refresh={refresh} onLogout={() => void signOut()}>
        <Suspense fallback={<p className="page-sub">Loading…</p>}>
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Tool account={account} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/new"
              element={
                <ProtectedRoute>
                  <NewChase account={account} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/templates"
              element={
                <ProtectedRoute>
                  <Templates />
                </ProtectedRoute>
              }
            />
            <Route
              path="/account"
              element={
                <ProtectedRoute>
                  <Account account={account} refresh={refresh} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/team"
              element={
                <ProtectedRoute>
                  <Team account={account} refresh={refresh} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/branding"
              element={
                <ProtectedRoute>
                  <Branding account={account} refresh={refresh} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/clients"
              element={
                <ProtectedRoute>
                  <Clients account={account} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/webhooks"
              element={
                <ProtectedRoute>
                  <Webhooks account={account} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/connector"
              element={
                <ProtectedRoute>
                  <Connector account={account} />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
      </AppShell>
    </>
  );
}

export default function App() {
  return (
    <AccountProvider>
      <AppRoutes />
      <AppConsentBanner />
    </AccountProvider>
  );
}
