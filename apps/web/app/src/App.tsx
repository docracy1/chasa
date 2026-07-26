import { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Tool from "./pages/Tool";
import Login from "./pages/Login";
import Account from "./pages/Account";
import Admin from "./pages/Admin";
import Branding from "./pages/Branding";
import Webhooks from "./pages/Webhooks";
import Connector from "./pages/Connector";
import Clients from "./pages/Clients";
import AppShell from "./components/AppShell";
import { useAccount } from "./lib/useAccount";
import { track } from "./lib/analytics";

export default function App() {
  const { account, loading, refresh } = useAccount();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const isLogin = location.pathname === "/login";

  useEffect(() => {
    if (!isAdmin) track("dashboard_loaded");
  }, [isAdmin]);

  if (isAdmin) {
    return (
      <Routes>
        <Route path="/admin" element={<Admin />} />
      </Routes>
    );
  }

  if (isLogin) {
    return (
      <div className="app-auth">
        <a href="/" className="app-auth-brand" aria-label="Chasa home">
          <img src="/brand/chasa-icon.png" alt="" width="28" height="28" />
          <span>chasa</span>
        </a>
        <Routes>
          <Route path="/login" element={<Login />} />
        </Routes>
      </div>
    );
  }

  return (
    <AppShell account={account} loading={loading} refresh={refresh}>
      <Routes>
        <Route path="/" element={<Tool account={account} />} />
        <Route path="/account" element={<Account account={account} refresh={refresh} />} />
        <Route path="/branding" element={<Branding account={account} refresh={refresh} />} />
        <Route path="/clients" element={<Clients account={account} />} />
        <Route path="/webhooks" element={<Webhooks account={account} />} />
        <Route path="/connector" element={<Connector account={account} />} />
      </Routes>
    </AppShell>
  );
}
