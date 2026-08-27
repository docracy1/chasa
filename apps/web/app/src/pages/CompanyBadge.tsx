import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyTrustProfile, type Account, type TrustProfileRecord } from "../lib/api";
import { useT } from "../lib/i18n";

function formatUsDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function CompanyBadgePage({ account }: { account: Account | null }) {
  const t = useT();
  const [profile, setProfile] = useState<TrustProfileRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const appOrigin = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    if (!account) {
      setLoading(false);
      return;
    }
    getMyTrustProfile()
      .then((res) => setProfile(res.profile))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [account?.email]);

  if (!account) {
    return (
      <div className="panel">
        <h1>{t("companyBadge.title")}</h1>
        <p className="page-sub">{t("companyBadge.signInSub")}</p>
        <a className="btn-primary" href="/app/login">
          {t("nav.signin")}
        </a>
      </div>
    );
  }

  const publicUrl = profile ? `/trust/${profile.accountId}` : "";
  const downloadUrl = profile ? `${publicUrl}?download=1` : "";
  const workspaceLabel = account.workspaceName?.trim() || "docstoc.io account";

  return (
    <div className="webhooks-page">
      <section className="branding-card">
        <h1 className="webhooks-title">{t("companyBadge.title")}</h1>
        <p className="branding-help">{t("companyBadge.pageSub")}</p>

        {loading ? (
          <p className="page-sub">{t("common.loading")}</p>
        ) : profile ? (
          <>
            <div className="company-badge-cert" aria-label={t("companyBadge.previewLabel")}>
              <div className="company-badge-cert-brand">
                <img src="/brand/docstoc-icon.png" width={36} height={36} alt="" />
                <div>
                  <strong>chasa</strong>
                  <span>{t("companyBadge.certTag")}</span>
                </div>
              </div>
              <h2 className="company-badge-cert-title">{workspaceLabel}</h2>
              <dl className="company-badge-cert-meta">
                <div>
                  <dt>{t("companyBadge.metaVerified")}</dt>
                  <dd>{formatUsDate(profile.firstVerifiedAt)}</dd>
                </div>
                <div>
                  <dt>{t("companyBadge.metaBitcoin")}</dt>
                  <dd>
                    {profile.otsStatus === "confirmed"
                      ? t("companyBadge.otsConfirmed")
                      : t("companyBadge.otsPending")}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="company-badge-actions">
              <a className="btn-primary" href={downloadUrl} target="_blank" rel="noopener noreferrer">
                {t("companyBadge.downloadPdf")}
              </a>
              <a className="btn-secondary" href={publicUrl} target="_blank" rel="noopener noreferrer">
                {t("ssl.trustProfileView")}
              </a>
            </div>

            <p className="branding-help" style={{ marginTop: 20 }}>
              {profile.otsStatus === "confirmed"
                ? t("ssl.trustProfileConfirmed")
                : t("ssl.trustProfilePending")}
            </p>

            <p className="branding-help" style={{ marginTop: 16 }}>
              {t("ssl.trustProfileEmbed")}
            </p>
            <code className="company-badge-embed">
              {`<script src="${appOrigin}/api/trust/badge/${profile.accountId}.js" async></script>`}
            </code>
          </>
        ) : (
          <div style={{ marginTop: 16 }}>
            <p className="branding-help">{t("companyBadge.needSsl")}</p>
            <Link className="btn-primary" to="/ssl-domains" style={{ marginTop: 12, display: "inline-flex" }}>
              {t("companyBadge.goSsl")}
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
