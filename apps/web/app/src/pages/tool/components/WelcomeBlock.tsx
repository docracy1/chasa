import { Link } from "react-router-dom";
import { FREE_LIMIT } from "../../../lib/usage";
import type { Account } from "../../../lib/api";
import { useT } from "../../../lib/i18n";

interface WelcomeBlockProps {
  welcomeName: string | null;
  overdueCount: number;
  draftedCount: number;
  invoiceCount: number;
  isPaid: boolean;
  account: Account | null;
  usedCount: number;
}

export function WelcomeBlock({
  welcomeName,
  overdueCount,
  draftedCount,
  invoiceCount,
  isPaid,
  account,
  usedCount,
}: WelcomeBlockProps) {
  const t = useT();

  return (
    <section className="welcome-block">
      <h1>{welcomeName ? t("welcome.titleNamed", { name: welcomeName }) : t("welcome.title")}</h1>
      <p className="page-sub" style={{ marginBottom: 0 }}>
        {t("welcome.sub")}
      </p>

      <div className="welcome-attention">
        <div className={`welcome-stat${overdueCount > 0 ? " is-accent" : ""}`}>
          <span className="welcome-stat-label">{t("welcome.overdue")}</span>
          <strong>{overdueCount}</strong>
          <em>{invoiceCount === 0 ? t("welcome.overdueEmpty") : t("welcome.overdueIn")}</em>
        </div>
        <div className="welcome-stat">
          <span className="welcome-stat-label">{t("welcome.drafts")}</span>
          <strong>{draftedCount}</strong>
          <em>{t("welcome.neverSent")}</em>
        </div>
        <div className="welcome-stat">
          <span className="welcome-stat-label">{isPaid ? t("welcome.plan") : t("welcome.freeDrafts")}</span>
          <strong>{isPaid ? account?.plan ?? "paid" : `${Math.max(0, FREE_LIMIT - usedCount)}`}</strong>
          <em>{isPaid ? t("welcome.unlocked") : t("welcome.left", { limit: FREE_LIMIT })}</em>
        </div>
      </div>

      <h2 className="welcome-section-title">{t("welcome.startNew")}</h2>
      <div className="welcome-actions">
        <a className="welcome-action" href="#chase-workspace">
          <span className="welcome-action-icon" aria-hidden="true">
            +
          </span>
          <span>
            <strong>{t("welcome.action.chase")}</strong>
            <span>{t("welcome.action.chaseSub")}</span>
          </span>
        </a>
        <a className="welcome-action" href="#chase-workspace">
          <span className="welcome-action-icon" aria-hidden="true">
            ↗
          </span>
          <span>
            <strong>{t("welcome.action.csv")}</strong>
            <span>{t("welcome.action.csvSub")}</span>
          </span>
        </a>
        <Link className="welcome-action" to="/connector">
          <span className="welcome-action-icon" aria-hidden="true">
            ≡
          </span>
          <span>
            <strong>{t("welcome.action.connectors")}</strong>
            <span>{t("welcome.action.connectorsSub")}</span>
          </span>
        </Link>
        <Link className="welcome-action" to={isPaid ? "/clients" : "/account"}>
          <span className="welcome-action-icon" aria-hidden="true">
            ▤
          </span>
          <span>
            <strong>{t("welcome.action.aging")}</strong>
            <span>{isPaid ? t("welcome.action.agingPaid") : t("welcome.action.agingFree")}</span>
          </span>
        </Link>
      </div>

      <h2 className="welcome-section-title">{t("welcome.needsAttention")}</h2>
      {overdueCount === 0 ? (
        <div className="welcome-quiet">
          <span className="welcome-quiet-check" aria-hidden="true">
            ✓
          </span>
          <span>
            <strong>{t("welcome.caughtUp")}</strong>
            <span>
              {invoiceCount === 0 ? t("welcome.caughtUpEmpty") : t("welcome.caughtUpNone")}
            </span>
          </span>
        </div>
      ) : (
        <div className="welcome-quiet">
          <span
            className="welcome-quiet-check"
            aria-hidden="true"
            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
          >
            !
          </span>
          <span>
            <strong>
              {overdueCount === 1
                ? t("welcome.overdueOne", { count: overdueCount })
                : t("welcome.overdueMany", { count: overdueCount })}
            </strong>
            <span>{t("welcome.overdueHint")}</span>
          </span>
        </div>
      )}
    </section>
  );
}
