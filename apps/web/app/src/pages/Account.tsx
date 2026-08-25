import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  logout,
  openBillingPortal,
  startCheckout,
  updateDigestSettings,
  updateMarketingOptIn,
  type Account as AccountType,
} from "../lib/api";
import { track } from "../lib/analytics";
import { useT } from "../lib/i18n";

type StripeCheckoutPlan = "pro" | "business";

function isStripeCheckoutPlan(raw: string | null): raw is StripeCheckoutPlan {
  return raw === "pro" || raw === "business";
}

export default function Account({
  account,
  refresh,
}: {
  account: AccountType | null;
  refresh: () => Promise<void>;
}) {
  const t = useT();
  const [busy, setBusy] = useState<"pro" | "business" | "portal" | "digest" | "marketing" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const autoCheckoutStarted = useRef(false);

  async function handleUpgrade(plan: StripeCheckoutPlan) {
    setBusy(plan);
    setError(null);
    track("upgrade_clicked", { plan });
    try {
      const { url } = await startCheckout(plan);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
      setBusy(null);
    }
  }

  useEffect(() => {
    if (!account || autoCheckoutStarted.current) return;
    const plan = searchParams.get("plan");
    if (!isStripeCheckoutPlan(plan)) return;
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
        <h1>{t("account.notSignedIn")}</h1>
        <p className="page-sub">{t("account.notSignedInSub")}</p>
        <Link className="btn-primary" to="/login">
          {t("nav.signin")}
        </Link>
      </div>
    );
  }

  const acc = account;

  async function handleManageBilling() {
    setBusy("portal");
    setError(null);
    try {
      const { url } = await openBillingPortal();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
      setBusy(null);
    }
  }

  async function handleLogout() {
    await logout();
    await refresh();
    navigate("/login");
  }

  const plan = acc.plan;
  const showPro = plan === "free";
  const showBusiness = plan === "free" || plan === "pro";
  const isPaid = plan !== "free";
  const isBusiness = plan === "business";
  const checkoutStatus = searchParams.get("checkout");

  async function toggleDigest() {
    if (!isPaid || acc.digestEnabled == null) return;
    setBusy("digest");
    setError(null);
    try {
      await updateDigestSettings(!acc.digestEnabled);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(null);
    }
  }

  async function toggleMarketingOptIn() {
    setBusy("marketing");
    setError(null);
    try {
      await updateMarketingOptIn(!acc.marketingOptIn);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="panel account-panel">
      <h1>{t("account.title")}</h1>
      <p className="page-sub">
        {acc.email} · <span className={`plan-badge ${acc.plan}`}>{acc.plan}</span>
      </p>

      {checkoutStatus === "success" && <div className="success-msg">{t("account.checkoutOk")}</div>}
      {checkoutStatus === "cancelled" && (
        <div className="page-sub" style={{ marginBottom: 16 }}>
          {t("account.checkoutCancel")}
        </div>
      )}

      <section className="account-plan-section">
        <h2 className="account-section-title">{t("account.subscription")}</h2>
        <div className="upgrade-actions">
          {showPro && (
            <button className="btn-primary" onClick={() => handleUpgrade("pro")} disabled={!!busy}>
              {busy === "pro" ? t("common.redirecting") : t("account.upgradePro")}
            </button>
          )}
          {showBusiness && (
            <button className="btn-secondary" onClick={() => handleUpgrade("business")} disabled={!!busy}>
              {busy === "business" ? t("common.redirecting") : t("account.upgradeBusiness")}
            </button>
          )}
          {isPaid && (
            <button className="btn-secondary" onClick={handleManageBilling} disabled={!!busy}>
              {busy === "portal" ? t("common.redirecting") : t("account.manageBilling")}
            </button>
          )}
        </div>
        {error && <div className="error-msg">{error}</div>}
      </section>

      {isPaid && (
        <section className="account-plan-section">
          <h2 className="account-section-title">{t("account.digestTitle")}</h2>
          <p className="page-sub">{t("account.digestBody")}</p>
          <button className="btn-secondary" onClick={toggleDigest} disabled={busy === "digest"}>
            {busy === "digest"
              ? t("common.saving")
              : acc.digestEnabled !== false
                ? t("account.digestOn")
                : t("account.digestOff")}
          </button>
        </section>
      )}

      <section className="account-plan-section">
        <h2 className="account-section-title">{t("account.marketingTitle")}</h2>
        <p className="page-sub">{t("account.marketingBody")}</p>
        <button className="btn-secondary" onClick={toggleMarketingOptIn} disabled={busy === "marketing"}>
          {busy === "marketing"
            ? t("common.saving")
            : acc.marketingOptIn
              ? t("account.marketingOn")
              : t("account.marketingOff")}
        </button>
      </section>

      <section className="account-plan-section">
        <h2 className="account-section-title">{t("account.whatYouGet")}</h2>
        <ul className="plan-feature-list">
          <li>{t("account.featPro")}</li>
          <li>{t("account.featBusiness")}</li>
        </ul>
        {!isBusiness && isPaid && <p className="page-sub">{t("account.businessNudge")}</p>}
      </section>

      <div style={{ marginTop: 28 }}>
        <button className="btn-secondary" onClick={handleLogout}>
          {t("account.signOut")}
        </button>
      </div>
    </div>
  );
}
