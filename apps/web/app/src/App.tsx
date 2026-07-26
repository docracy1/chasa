import { useEffect } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import Tool from "./pages/Tool";
import Login from "./pages/Login";
import Account from "./pages/Account";
import Admin from "./pages/Admin";
import Branding from "./pages/Branding";
import Webhooks from "./pages/Webhooks";
import Connector from "./pages/Connector";
import { useAccount } from "./lib/useAccount";
import { track } from "./lib/analytics";

export default function App() {
  const { account, loading, refresh } = useAccount();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");

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

  const logoSrc = account?.logoDataUrl || "/brand/chasa-icon.png";
  const wordmark = account?.workspaceName || "chasa";

  return (
    <div className="wrap">
      <div className="topbar">
        <Link to="/" className="logo" aria-label="Home">
          <img className="logo-mark" src={logoSrc} alt="" width="26" height="26" />
          <span className="logo-word">{wordmark}</span>
        </Link>
        <div className="topbar-links">
          {!loading && account && (
            <span className={`plan-badge ${account.plan}`}>{account.plan}</span>
          )}
          {account && <Link to="/branding">Branding</Link>}
          {account && <Link to="/webhooks">Webhooks</Link>}
          {account && <Link to="/connector">Connector</Link>}
          <Link to="/account">{account ? "Account" : "Sign in"}</Link>
          <a href="/">Marketing site</a>
        </div>
      </div>

      <Routes>
        <Route path="/" element={<Tool account={account} />} />
        <Route path="/login" element={<Login />} />
        <Route path="/account" element={<Account account={account} refresh={refresh} />} />
        <Route path="/branding" element={<Branding account={account} refresh={refresh} />} />
        <Route path="/webhooks" element={<Webhooks account={account} />} />
        <Route path="/connector" element={<Connector account={account} />} />
      </Routes>
    </div>
  );
}
