import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { logout, openBillingPortal, startCheckout, type Account as AccountType } from "../lib/api";

type CheckoutPlan = "solo" | "pro" | "enterprise";

function isCheckoutPlan(raw: string | null): raw is CheckoutPlan {
  return raw === "solo" || raw === "pro" || raw === "enterprise";
}

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
  const [searchParams, setSearchParams] = useSearchParams();
  const autoCheckoutStarted = useRef(false);

  async function handleUpgrade(plan: CheckoutPlan) {
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

  useEffect(() => {
    if (!account || autoCheckoutStarted.current) return;
    const plan = searchParams.get("plan");
    if (!isCheckoutPlan(plan)) return;
    if (account.plan === plan) {
      setSearchParams({}, { replace: true });
      return;
    }
    autoCheckoutStarted.current = true;
    setSearchParams({}, { replace: true });
    void handleUpgrade(plan);
  }, [account, searchParams, setSearchParams]);

  if (!account) {
    return (
      <div className="panel">
        <h1>You're not signed in</h1>
        <p className="page-sub">Sign in to manage your subscription and see your account.</p>
        <Link className="btn-primary" to="/login">
          Sign in
        </Link>
      </div>
    );
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
    navigate("/login");
  }

  const plan = account.plan;
  const showSolo = plan === "free";
  const showPro = plan === "free" || plan === "solo";
  const showEnterprise = plan === "free" || plan === "solo" || plan === "pro";
  const isPaid = plan !== "free";
  const checkoutStatus = searchParams.get("checkout");

  return (
    <div className="panel account-panel">
      <h1>Your account</h1>
      <p className="page-sub">
        {account.email} · <span className={`plan-badge ${account.plan}`}>{account.plan}</span>
      </p>

      {checkoutStatus === "success" && (
        <div className="success-msg">Checkout complete — your plan will update shortly.</div>
      )}
      {checkoutStatus === "cancelled" && (
        <div className="page-sub" style={{ marginBottom: 16 }}>
          Checkout cancelled. You can try again anytime.
        </div>
      )}

      <section className="account-plan-section">
        <h2 className="account-section-title">Subscription</h2>
        <div className="upgrade-actions">
          {showSolo && (
            <button className="btn-primary" onClick={() => handleUpgrade("solo")} disabled={!!busy}>
              {busy === "solo" ? "Redirecting…" : "Upgrade to Solo — $7/mo"}
            </button>
          )}
          {showPro && (
            <button className="btn-secondary" onClick={() => handleUpgrade("pro")} disabled={!!busy}>
              {busy === "pro" ? "Redirecting…" : "Upgrade to Pro — $17/mo"}
            </button>
          )}
          {showEnterprise && (
            <button
              className="btn-secondary"
              onClick={() => handleUpgrade("enterprise")}
              disabled={!!busy}
            >
              {busy === "enterprise" ? "Redirecting…" : "Upgrade to Enterprise"}
            </button>
          )}
          {isPaid && (
            <button className="btn-secondary" onClick={handleManageBilling} disabled={!!busy}>
              {busy === "portal" ? "Redirecting…" : "Manage billing"}
            </button>
          )}
        </div>
        {error && <div className="error-msg">{error}</div>}
      </section>

      <div style={{ marginTop: 28 }}>
        <button className="btn-secondary" onClick={handleLogout}>
          Sign out
        </button>
      </div>
    </div>
  );
}
