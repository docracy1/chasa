import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { logout, type Account } from "../lib/api";
import UserChip from "./UserChip";

const NAV = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/clients", label: "Clients" },
  { to: "/connector", label: "Test connectors" },
  { to: "/team", label: "Team" },
  { to: "/branding", label: "Branding" },
  { to: "/webhooks", label: "Webhooks" },
  { to: "/account", label: "Account" },
] as const;

export default function AppShell({
  account,
  loading,
  refresh,
  onLogout,
  children,
}: {
  account: Account | null;
  loading: boolean;
  refresh: () => Promise<void>;
  onLogout?: () => void | Promise<void>;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const logoSrc = account?.logoDataUrl || "/brand/chasa-icon.png";
  const wordmark = account?.workspaceName || "chasa";

  async function handleLogout() {
    if (onLogout) {
      await onLogout();
      return;
    }
    await logout();
    await refresh();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link to="/" className="app-brand" aria-label="Home">
          <img src={logoSrc} alt="" width="28" height="28" />
          <span>{wordmark}</span>
        </Link>

        <Link to="/" className="dash-new-btn" onClick={() => {
          // Focus the chase form after navigation
          requestAnimationFrame(() => {
            document.getElementById("chase-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
          });
        }}>
          + New chase
        </Link>

        <nav className="dash-side-nav" aria-label="App">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={"end" in item ? item.end : false}
              className={({ isActive }) => (isActive ? "is-active" : undefined)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="dash-side-footer">
          {!loading && account ? (
            <UserChip email={account.email} plan={account.plan} onLogout={handleLogout} />
          ) : !loading ? (
            <Link to="/login" className="app-signin-chip">
              Sign in
            </Link>
          ) : (
            <div className="app-signin-chip is-muted">Loading…</div>
          )}
        </div>
      </aside>

      <main className="app-main">{children}</main>
    </div>
  );
}
