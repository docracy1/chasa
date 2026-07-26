import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getBranding, updateBranding, type Account, type Branding } from "../lib/api";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read file"));
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
  const [branding, setBranding] = useState<Branding | null>(null);
  const [name, setName] = useState("");
  const [paymentLink, setPaymentLink] = useState("");
  const [lateFeeEnabled, setLateFeeEnabled] = useState(false);
  const [lateFeeHint, setLateFeeHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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
        <h1>Branding</h1>
        <p className="page-sub">Sign in to set your workspace logo and name.</p>
        <a className="btn-primary" href="/app/login">
          Sign in
        </a>
      </div>
    );
  }

  const isPaid = account.plan !== "free";

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
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !isPaid) return;
    if (file.size > 100_000) {
      setError("Logo is too large — keep under ~100KB.");
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
      setError(err instanceof Error ? err.message : "Upload failed");
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
      setError(err instanceof Error ? err.message : "Remove failed");
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
      setError(err instanceof Error ? err.message : "Remove failed");
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
      setError(err instanceof Error ? err.message : "Save failed");
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
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="branding-page">
      <p className="crumb">
        <Link to="/account">Account</Link> / Branding
      </p>
      <h1>Branding</h1>
      <p className="page-sub">
        Replace the Chasa logo with your own in the app, set a short workspace name, and optionally a
        default payment link for chase drafts.
      </p>

      {!isPaid && (
        <div className="upgrade-nudge">
          Branding is included on Solo and up.{" "}
          <Link to="/account">Upgrade</Link> to unlock logo + workspace name.
        </div>
      )}

      <section className="branding-card">
        <h2>Logo</h2>
        <p className="branding-help">Shown in the app header instead of the default Chasa mark.</p>
        <div className="branding-logo-row">
          <div className="branding-logo-preview">
            <img
              src={branding?.logoDataUrl || "/brand/chasa-icon.png"}
              alt=""
              width="40"
              height="40"
            />
          </div>
          {isPaid ? (
            <>
              <label className="btn-secondary" style={{ cursor: busy ? "wait" : "pointer" }}>
                {branding?.logoDataUrl ? "Replace logo" : "Upload logo"}
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
                  Remove logo
                </button>
              )}
            </>
          ) : (
            <button type="button" className="btn-secondary" disabled>
              Upload logo
            </button>
          )}
        </div>
      </section>

      <section className="branding-card">
        <h2>Workspace name</h2>
        <p className="branding-help">
          A short label shown next to your logo. Letters and numbers only, 3–30 characters.
        </p>
        <form className="branding-name-row" onSubmit={saveName}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. relacon"
            minLength={3}
            maxLength={30}
            disabled={!isPaid || busy}
            pattern="[A-Za-z0-9][A-Za-z0-9 _\-]{1,28}[A-Za-z0-9]|[A-Za-z0-9]{3,30}"
          />
          {isPaid && (
            <>
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </button>
              {branding?.workspaceName && (
                <button type="button" className="btn-secondary" disabled={busy} onClick={removeName}>
                  Remove
                </button>
              )}
            </>
          )}
        </form>
        {saved && <p className="branding-saved">Saved.</p>}
      </section>

      <section className="branding-card">
        <h2>Default payment link</h2>
        <p className="branding-help">
          Stripe Payment Link, PayPal.me, Wise, or any pay URL. Included in AI chase drafts when set
          (you can still override per session in the Tool).
        </p>
        <form className="branding-name-row" onSubmit={savePaymentLink}>
          <input
            type="url"
            value={paymentLink}
            onChange={(e) => setPaymentLink(e.target.value)}
            placeholder="https://buy.stripe.com/…"
            disabled={!isPaid || busy}
          />
          {isPaid && (
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          )}
        </form>
      </section>

      <section className="branding-card">
        <h2>Late-fee hint</h2>
        <p className="branding-help">
          Optional. When enabled, AI drafts can include one factual late-fee / interest line (amount,
          %, or free text). Chasa never charges clients — wording only.
        </p>
        <form onSubmit={saveLateFee}>
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={lateFeeEnabled}
              onChange={(e) => setLateFeeEnabled(e.target.checked)}
              disabled={!isPaid || busy}
            />
            Include late-fee line in drafts
          </label>
          <div className="branding-name-row">
            <input
              type="text"
              value={lateFeeHint}
              onChange={(e) => setLateFeeHint(e.target.value)}
              placeholder="e.g. 1.5% per month or $25 late fee after 30 days"
              maxLength={200}
              disabled={!isPaid || busy}
            />
            {isPaid && (
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </button>
            )}
          </div>
        </form>
      </section>

      {error && <div className="error-msg">{error}</div>}
    </div>
  );
}
