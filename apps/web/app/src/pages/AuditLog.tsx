import { useEffect, useState } from "react";
import { listAuditAnchors, type AuditAnchorRecord, type Account } from "../lib/api";
import { useT } from "../lib/i18n";

export default function AuditLogPage({ account }: { account: Account | null }) {
  const t = useT();
  const [anchors, setAnchors] = useState<AuditAnchorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!account) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await listAuditAnchors();
        setAnchors(res.anchors);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("auditLog.loadFailed"));
      } finally {
        setLoading(false);
      }
    })();
  }, [account?.email]);

  if (!account) {
    return (
      <div className="panel">
        <h1>{t("auditLog.title")}</h1>
        <p className="page-sub">{t("auditLog.signInSub")}</p>
        <a className="btn-primary" href="/app/login">
          {t("nav.signin")}
        </a>
      </div>
    );
  }

  return (
    <div className="webhooks-page">
      <section className="branding-card">
        <h1 className="webhooks-title">{t("auditLog.title")}</h1>
        <p className="branding-help">{t("auditLog.pageSub")}</p>

        {error && <div className="error-msg">{error}</div>}

        {loading ? (
          <p className="page-sub">{t("common.loading")}</p>
        ) : anchors.length === 0 ? (
          <p className="webhooks-empty">{t("auditLog.empty")}</p>
        ) : (
          <ul className="webhooks-list">
            {anchors.map((anchor) => (
              <li key={anchor.id}>
                <div>
                  <code>{anchor.periodDate}</code>
                  <div className="page-sub">
                    {t("auditLog.eventCount", { count: anchor.eventCount })} ·{" "}
                    {anchor.otsStatus === "confirmed"
                      ? t("auditLog.otsConfirmed")
                      : anchor.otsStatus === "pending"
                      ? t("auditLog.otsPending")
                      : t("auditLog.otsNone")}
                  </div>
                </div>
                {anchor.otsStatus === "confirmed" && (
                  <a
                    className="btn-secondary"
                    href={`/api/audit-log/anchors/${anchor.id}/proof.ots`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("auditLog.downloadProof")}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
