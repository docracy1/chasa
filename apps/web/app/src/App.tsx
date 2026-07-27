import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import AppShell from "./components/AppShell";
import ProtectedRoute from "./components/ProtectedRoute";
import AppConsentBanner from "./components/AppConsentBanner";
import { AccountProvider, useAccountContext } from "./lib/AccountContext";
import { setUnauthorizedHandler } from "./lib/api";
import { track } from "./lib/analytics";

const Tool = lazy(() => import("./pages/Tool"));
const Login = lazy(() => import("./pages/Login"));
const Account = lazy(() => import("./pages/Account"));
const Admin = lazy(() => import("./pages/Admin"));
const Branding = lazy(() => import("./pages/Branding"));
const Webhooks = lazy(() => import("./pages/Webhooks"));
const Connector = lazy(() => import("./pages/Connector"));
const Clients = lazy(() => import("./pages/Clients"));
const Team = lazy(() => import("./pages/Team"));

function AppRoutes() {
  const { account, loading, refresh, signOut } = useAccountContext();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const isLogin = location.pathname === "/login";

  useEffect(() => {
    setUnauthorizedHandler(() => {
      window.location.href = "/app/login";
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
        <a href="/" className="app-auth-brand" aria-label="Chasa home">
          <img src="/brand/chasa-icon.png" alt="" width="28" height="28" />
          <span>chasa</span>
        </a>
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
      <AppConsentBanner />
    </>
  );
}

export default function App() {
  return (
    <AccountProvider>
      <AppRoutes />
    </AccountProvider>
  );
}
