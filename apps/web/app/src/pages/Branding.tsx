import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getBranding, updateBranding, type Account, type Branding } from "../lib/api";
import { detectPaymentProvider, paymentProviderLabel } from "../lib/paymentProvider";
import { isWorkspaceAdmin } from "../lib/plan";
import { useT } from "../lib/i18n";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read_failed"));
    reader.readAsDataURL(file);
  });
}

export default function BrandingPage({
  account,
  refresh,
}: {
  account: Account | null;
  refresh: () => Promise<void>;
}) {
  const t = useT();
  const [branding, setBranding] = useState<Branding | null>(null);
  const [name, setName] = useState("");
  const [paymentLink, setPaymentLink] = useState("");
  const [lateFeeEnabled, setLateFeeEnabled] = useState(false);
  const [lateFeeHint, setLateFeeHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const paymentProvider = useMemo(
    () => (paymentLink.trim() ? detectPaymentProvider(paymentLink) : null),
    [paymentLink]
  );

  useEffect(() => {
    if (!account) return;
    getBranding()
      .then((b) => {
        setBranding(b);
        setName(b.workspaceName ?? "");
        setPaymentLink(b.paymentLink ?? "");
        setLateFeeEnabled(!!b.lateFeeEnabled);
        setLateFeeHint(b.lateFeeHint ?? "");
      })
      .catch(() =>
        setBranding({
          workspaceName: null,
          logoDataUrl: null,
          paymentLink: null,
          lateFeeEnabled: false,
          lateFeeHint: null,
          paid: false,
        })
      );
  }, [account]);

  if (!account) {
    return (
      <div className="panel">
        <h1>{t("branding.title")}</h1>
        <p className="page-sub">{t("branding.signInSub")}</p>
        <a className="btn-primary" href="/app/login">
          {t("nav.signin")}
        </a>
      </div>
    );
  }

  const isPaid = account.plan !== "free";
  const canEdit = isPaid && isWorkspaceAdmin(account);

  if (isPaid && !canEdit) {
    return (
      <div className="branding-page">
        <p className="crumb">
          <Link to="/">{t("nav.dashboard")}</Link> / {t("branding.title")}
        </p>
        <h1>{t("branding.title")}</h1>
        <div className="panel">
          <p className="page-sub">{t("workspace.adminOnly")}</p>
          <Link className="btn-secondary" to="/">
            {t("nav.dashboard")}
          </Link>
        </div>
      </div>
    );
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!isPaid) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const next = await updateBranding({
        workspaceName: name.trim(),
        removeName: name.trim().length === 0,
      });
      setBranding(next);
      setName(next.workspaceName ?? "");
      setSaved(true);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("branding.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !isPaid) return;
    if (file.size > 100_000) {
      setError(t("branding.logoTooLarge"));
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const logoDataUrl = await fileToDataUrl(file);
      const next = await updateBranding({ logoDataUrl });
      setBranding(next);
      setSaved(true);
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error && err.message === "read_failed"
          ? t("branding.readFileFailed")
          : err instanceof Error
            ? err.message
            : t("branding.uploadFailed")
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeLogo() {
    if (!isPaid) return;
    setBusy(true);
    setError(null);
    try {
      const next = await updateBranding({ removeLogo: true });
      setBranding(next);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("branding.removeFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function removeName() {
    if (!isPaid) return;
    setBusy(true);
    setError(null);
    try {
      const next = await updateBranding({ removeName: true });
      setBranding(next);
      setName("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("branding.removeFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function savePaymentLink(e: React.FormEvent) {
    e.preventDefault();
    if (!isPaid) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const next = await updateBranding({
        paymentLink: paymentLink.trim(),
        removePaymentLink: paymentLink.trim().length === 0,
      });
      setBranding(next);
      setPaymentLink(next.paymentLink ?? "");
      setSaved(true);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("branding.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function saveLateFee(e: React.FormEvent) {
    e.preventDefault();
    if (!isPaid) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const next = await updateBranding({
        lateFeeEnabled,
        lateFeeHint: lateFeeHint.trim(),
      });
      setBranding(next);
      setLateFeeEnabled(!!next.lateFeeEnabled);
      setLateFeeHint(next.lateFeeHint ?? "");
      setSaved(true);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("branding.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="branding-page">
      <p className="crumb">
        <Link to="/account">{t("team.crumbAccount")}</Link> / {t("branding.title")}
      </p>
      <h1>{t("branding.title")}</h1>
      <p className="page-sub">{t("branding.pageSub")}</p>

      {!isPaid && (
        <div className="upgrade-nudge">
          {t("branding.upgradeNudge")}{" "}
          <Link to="/account">{t("branding.upgradeLink")}</Link> {t("branding.upgradeHint")}
        </div>
      )}

      <section className="branding-card">
        <h2>{t("branding.logo")}</h2>
        <p className="branding-help">{t("branding.logoHelp")}</p>
        <div className="branding-logo-row">
          <div className="branding-logo-preview">
            <img
              src={branding?.logoDataUrl || "/brand/docstoc-icon.png"}
              alt=""
              width="40"
              height="40"
            />
          </div>
          {isPaid ? (
            <>
              <label className="btn-secondary" style={{ cursor: busy ? "wait" : "pointer" }}>
                {branding?.logoDataUrl ? t("branding.replace") : t("branding.upload")}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={onLogo}
                  disabled={busy}
                  style={{ display: "none" }}
                />
              </label>
              {branding?.logoDataUrl && (
                <button type="button" className="btn-secondary" disabled={busy} onClick={removeLogo}>
                  {t("branding.removeLogo")}
                </button>
              )}
            </>
          ) : (
            <button type="button" className="btn-secondary" disabled>
              {t("branding.upload")}
            </button>
          )}
        </div>
      </section>

      <section className="branding-card">
        <h2>{t("branding.workspaceName")}</h2>
        <p className="branding-help">{t("branding.workspaceHelp")}</p>
        <form className="branding-name-row" onSubmit={saveName}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("branding.workspacePlaceholder")}
            minLength={3}
            maxLength={30}
            disabled={!isPaid || busy}
            pattern="[A-Za-z0-9][A-Za-z0-9 _\-]{1,28}[A-Za-z0-9]|[A-Za-z0-9]{3,30}"
          />
          {isPaid && (
            <>
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? t("common.saving") : t("common.save")}
              </button>
              {branding?.workspaceName && (
                <button type="button" className="btn-secondary" disabled={busy} onClick={removeName}>
                  {t("common.remove")}
                </button>
              )}
            </>
          )}
        </form>
        {saved && <p className="branding-saved">{t("branding.saved")}</p>}
      </section>

      <section className="branding-card">
        <h2>{t("branding.paymentLink")}</h2>
        <p className="branding-help">{t("branding.paymentHelp")}</p>
        <form className="branding-name-row" onSubmit={savePaymentLink}>
          <input
            type="url"
            value={paymentLink}
            onChange={(e) => setPaymentLink(e.target.value)}
            placeholder={t("branding.paymentPlaceholder")}
            disabled={!isPaid || busy}
          />
          {isPaid && (
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? t("common.saving") : t("common.save")}
            </button>
          )}
        </form>
        {paymentProvider && paymentLink.trim() && (
          <p className="branding-help">
            {t("branding.detectedProvider", { provider: paymentProviderLabel(paymentProvider) })}
          </p>
        )}
      </section>

      <section className="branding-card">
        <h2>{t("branding.lateFee")}</h2>
        <p className="branding-help">{t("branding.lateFeeHelp")}</p>
        <form onSubmit={saveLateFee}>
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={lateFeeEnabled}
              onChange={(e) => setLateFeeEnabled(e.target.checked)}
              disabled={!isPaid || busy}
            />
            {t("branding.lateFeeToggle")}
          </label>
          <div className="branding-name-row">
            <input
              type="text"
              value={lateFeeHint}
              onChange={(e) => setLateFeeHint(e.target.value)}
              placeholder={t("branding.lateFeePlaceholder")}
              maxLength={200}
              disabled={!isPaid || busy}
            />
            {isPaid && (
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? t("common.saving") : t("common.save")}
              </button>
            )}
          </div>
        </form>
      </section>

      {error && <div className="error-msg">{error}</div>}
    </div>
  );
}
