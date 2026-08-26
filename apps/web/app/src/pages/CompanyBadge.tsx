import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyTrustProfile, type Account, type TrustProfileRecord } from "../lib/api";
import { useT } from "../lib/i18n";

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

  return (
    <div className="webhooks-page">
      <section className="branding-card">
        <h1 className="webhooks-title">{t("companyBadge.title")}</h1>
        <p className="branding-help">{t("companyBadge.pageSub")}</p>

        {loading ? (
          <p className="page-sub">{t("common.loading")}</p>
        ) : profile ? (
          <>
            <p className="branding-help" style={{ marginTop: 16 }}>
              {profile.otsStatus === "confirmed"
                ? t("ssl.trustProfileConfirmed")
                : t("ssl.trustProfilePending")}
            </p>
            <p style={{ marginTop: 12 }}>
              <a
                className="btn-secondary"
                href={`/trust/${profile.accountId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("ssl.trustProfileView")}
              </a>
            </p>
            <p className="branding-help" style={{ marginTop: 16 }}>
              {t("ssl.trustProfileEmbed")}
            </p>
            <code style={{ display: "block", whiteSpace: "pre-wrap", wordBreak: "break-all", marginTop: 8 }}>
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
