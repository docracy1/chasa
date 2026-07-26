import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { logout, openBillingPortal, startCheckout, type Account as AccountType } from "../lib/api";

export default function Account({
  account,
  refresh,
}: {
  account: AccountType | null;
  refresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<"solo" | "pro" | "enterprise" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  if (!account) {
    return (
      <div className="panel">
        <h1>You're not signed in</h1>
        <p className="page-sub">Sign in to manage your subscription and see your account.</p>
        <a className="btn-primary" href="/app/login">
          Sign in
        </a>
      </div>
    );
  }

  async function handleUpgrade(plan: "solo" | "pro" | "enterprise") {
    setBusy(plan);
    setError(null);
    try {
      const { url } = await startCheckout(plan);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(null);
    }
  }

  async function handleManageBilling() {
    setBusy("portal");
    setError(null);
    try {
      const { url } = await openBillingPortal();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(null);
    }
  }

  async function handleLogout() {
    await logout();
    await refresh();
    navigate("/");
  }

  const isFree = account.plan === "free";

  return (
    <div className="panel">
      <h1>Your account</h1>
      <p className="page-sub">
        {account.email} · <span className={`plan-badge ${account.plan}`}>{account.plan}</span>
      </p>

      {isFree ? (
        <div className="upgrade-actions">
          <button className="btn-primary" onClick={() => handleUpgrade("solo")} disabled={!!busy}>
            {busy === "solo" ? "Redirecting…" : "Upgrade to Solo — $7/mo"}
          </button>
          <button className="btn-secondary" onClick={() => handleUpgrade("pro")} disabled={!!busy}>
            {busy === "pro" ? "Redirecting…" : "Upgrade to Pro — $17/mo"}
          </button>
          <button className="btn-secondary" onClick={() => handleUpgrade("enterprise")} disabled={!!busy}>
            {busy === "enterprise" ? "Redirecting…" : "Enterprise"}
          </button>
          <a className="btn-secondary" href="/app/branding">
            Branding
          </a>
          <a className="btn-secondary" href="/app/webhooks">
            Webhooks
          </a>
          <a className="btn-secondary" href="/app/connector">
            Connector
          </a>
        </div>
      ) : (
        <div className="upgrade-actions">
          <button className="btn-secondary" onClick={handleManageBilling} disabled={!!busy}>
            {busy === "portal" ? "Redirecting…" : "Manage billing"}
          </button>
          <a className="btn-secondary" href="/app/branding">
            Branding
          </a>
          <a className="btn-secondary" href="/app/webhooks">
            Webhooks
          </a>
          <a className="btn-secondary" href="/app/connector">
            Connector
          </a>
        </div>
      )}

      {error && <div className="error-msg">{error}</div>}

      <div style={{ marginTop: 24 }}>
        <button className="btn-secondary" onClick={handleLogout}>
          Sign out
        </button>
      </div>
    </div>
  );
}
