import { FormEvent, useEffect, useState } from "react";
import {
  createCustomHostname,
  deleteCustomHostname,
  downloadCustomHostname,
  getMyTrustProfile,
  listCustomHostnames,
  renewCustomHostname,
  verifyCustomHostname,
  type Account,
  type CustomerCertificate,
  type TrustProfileRecord,
} from "../lib/api";
import { isPaidPlan } from "../lib/plan";
import { useT } from "../lib/i18n";

function downloadTextFile(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "application/x-pem-file" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SslCertificatesPage({ account }: { account: Account | null }) {
  const t = useT();
  const isPaid = isPaidPlan(account);
  const [certificates, setCertificates] = useState<CustomerCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<Record<string, string>>({});
  const [installHelpId, setInstallHelpId] = useState<string | null>(null);
  const [trustProfile, setTrustProfile] = useState<TrustProfileRecord | null>(null);
  const appOrigin = typeof window !== "undefined" ? window.location.origin : "";

  async function refresh() {
    setLoading(true);
    try {
      const res = await listCustomHostnames();
      setCertificates(res.certificates);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("ssl.loadFailed"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (account && isPaid) {
      refresh();
      getMyTrustProfile()
        .then((res) => setTrustProfile(res.profile))
        .catch(() => {});
    } else {
      setLoading(false);
    }
  }, [account?.email, isPaid]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createCustomHostname(domain.trim());
      setDomain("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("ssl.addFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(id: string) {
    setBusy(true);
    setError(null);
    setPendingMessage((prev) => ({ ...prev, [id]: "" }));
    try {
      const res = await verifyCustomHostname(id);
      if (res.status === "pending") {
        setPendingMessage((prev) => ({ ...prev, [id]: t("ssl.stillPending") }));
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("ssl.checkFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleRenew(id: string) {
    setBusy(true);
    setError(null);
    setPendingMessage((prev) => ({ ...prev, [id]: "" }));
    try {
      await renewCustomHostname(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("ssl.renewFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload(cert: CustomerCertificate) {
    setBusy(true);
    setError(null);
    try {
      const res = await downloadCustomHostname(cert.id);
      const safe = cert.domain.replace(/[^a-zA-Z0-9.-]/g, "_");
      downloadTextFile(`${safe}.crt.pem`, res.certificatePem);
      downloadTextFile(`${safe}.key.pem`, res.privateKeyPem);
      setInstallHelpId(cert.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("ssl.downloadFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm(t("ssl.removeConfirm"))) return;
    setBusy(true);
    setError(null);
    try {
      await deleteCustomHostname(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("ssl.removeFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (!account) {
    return (
      <div className="panel">
        <h1>{t("ssl.title")}</h1>
        <p className="page-sub">{t("ssl.signInSub")}</p>
        <a className="btn-primary" href="/app/login">
          {t("nav.signin")}
        </a>
      </div>
    );
  }

  if (!isPaid) {
    return (
      <div className="webhooks-page">
        <h1 className="webhooks-title">{t("ssl.title")}</h1>
        <div className="panel">
          <p className="page-sub">{t("ssl.upgradeNudge")}</p>
          <a className="btn-primary" href="/app/account">
            {t("ssl.upgradeLink")}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="webhooks-page">
      <section className="branding-card">
        <h1 className="webhooks-title">{t("ssl.title")}</h1>
        <p className="branding-help">{t("ssl.pageSub")}</p>
        <p className="branding-help" style={{ marginTop: 8 }}>
          <a href="/ssl/features/installation" target="_blank" rel="noopener noreferrer">
            {t("ssl.installGuideLink")}
          </a>
        </p>

        <form onSubmit={handleAdd} style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <input
            type="text"
            required
            placeholder={t("ssl.domainPlaceholder")}
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            disabled={busy}
            style={{ flex: 1, minWidth: 220, padding: 8 }}
          />
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? t("common.saving") : t("ssl.add")}
          </button>
        </form>

        {error && <div className="error-msg">{error}</div>}

        {loading ? (
          <p className="page-sub">{t("common.loading")}</p>
        ) : certificates.length === 0 ? (
          <p className="webhooks-empty">{t("ssl.empty")}</p>
        ) : (
          <ul className="webhooks-list">
            {certificates.map((cert) => (
              <li key={cert.id} style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <code>{cert.domain}</code>
                    <div className="page-sub">
                      {cert.status === "issued"
                        ? t("ssl.statusActive")
                        : cert.status === "expiring"
                          ? t("ssl.statusExpiring")
                          : cert.status === "failed"
                            ? t("ssl.statusError")
                            : t("ssl.statusPending")}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {(cert.status === "issued" || cert.status === "expiring") && (
                      <button type="button" className="btn-secondary" disabled={busy} onClick={() => handleDownload(cert)}>
                        {t("ssl.download")}
                      </button>
                    )}
                    {cert.status === "expiring" ? (
                      <button type="button" className="btn-secondary" disabled={busy} onClick={() => handleRenew(cert.id)}>
                        {t("ssl.renew")}
                      </button>
                    ) : cert.status !== "issued" ? (
                      <button type="button" className="btn-secondary" disabled={busy} onClick={() => handleVerify(cert.id)}>
                        {t("ssl.checkStatus")}
                      </button>
                    ) : null}
                    <button type="button" className="btn-secondary" disabled={busy} onClick={() => handleDelete(cert.id)}>
                      {t("common.remove")}
                    </button>
                  </div>
                </div>

                {(cert.lastError || pendingMessage[cert.id]) && (
                  <p className="error-msg">{pendingMessage[cert.id] || cert.lastError}</p>
                )}

                {cert.status !== "issued" && cert.status !== "expiring" && cert.dns01TxtValue && (
                  <div className="branding-card" style={{ margin: 0 }}>
                    <p className="branding-help">{t("ssl.step1Txt")}</p>
                    <code>{`TXT  _acme-challenge.${cert.domain}  →  ${cert.dns01TxtValue}`}</code>
                    <p className="branding-help" style={{ marginTop: 10 }}>
                      {t("ssl.step2Wait")}
                    </p>
                  </div>
                )}

                {installHelpId === cert.id && (
                  <div className="branding-card" style={{ margin: 0 }}>
                    <p className="branding-help">{t("ssl.installHelp")}</p>
                    <ul className="branding-help" style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                      <li>{t("ssl.installNginx")}</li>
                      <li>{t("ssl.installApache")}</li>
                      <li>{t("ssl.installCaddy")}</li>
                    </ul>
                    <p className="branding-help" style={{ marginTop: 10 }}>
                      <a href="/ssl/features/installation" target="_blank" rel="noopener noreferrer">
                        {t("ssl.installGuideLink")}
                      </a>
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {trustProfile && (
          <div className="branding-card" style={{ marginTop: 20 }}>
            <h2>{t("ssl.trustProfileTitle")}</h2>
            <p className="branding-help">
              {trustProfile.otsStatus === "confirmed" ? t("ssl.trustProfileConfirmed") : t("ssl.trustProfilePending")}
            </p>
            <p style={{ marginTop: 8 }}>
              <a
                className="btn-secondary"
                href={`/trust/${trustProfile.accountId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("ssl.trustProfileView")}
              </a>
            </p>
            <p className="branding-help" style={{ marginTop: 12 }}>
              {t("ssl.trustProfileEmbed")}
            </p>
            <code style={{ display: "block", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {`<script src="${appOrigin}/api/trust/badge/${trustProfile.accountId}.js" async></script>`}
            </code>
          </div>
        )}
      </section>
    </div>
  );
}
