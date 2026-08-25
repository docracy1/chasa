import { Link } from "react-router-dom";
import { FREE_LIMIT } from "../../../lib/usage";
import type { Account } from "../../../lib/api";
import { isWorkspaceAdmin } from "../../../lib/plan";
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
  const showConnectors = isWorkspaceAdmin(account);

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
        <Link className="welcome-action" to="/new">
          <span className="welcome-action-icon" aria-hidden="true">
            +
          </span>
          <span>
            <strong>{t("welcome.action.chase")}</strong>
            <span>{t("welcome.action.chaseSub")}</span>
          </span>
        </Link>
        <Link className="welcome-action" to="/new">
          <span className="welcome-action-icon" aria-hidden="true">
            ↗
          </span>
          <span>
            <strong>{t("welcome.action.csv")}</strong>
            <span>{t("welcome.action.csvSub")}</span>
          </span>
        </Link>
        {showConnectors ? (
          <Link className="welcome-action" to="/connector">
            <span className="welcome-action-icon" aria-hidden="true">
              ≡
            </span>
            <span>
              <strong>{t("welcome.action.connectors")}</strong>
              <span>{t("welcome.action.connectorsSub")}</span>
            </span>
          </Link>
        ) : null}
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

      {isPaid ? (
        <>
          <h2 className="welcome-section-title">{t("welcome.aiTools.title")}</h2>
          <div className="welcome-ai-tools">
            <div className="welcome-ai-tool">
              <strong>{t("welcome.aiTools.tone.title")}</strong>
              <span>{t("welcome.aiTools.tone.body")}</span>
            </div>
            <div className="welcome-ai-tool">
              <strong>{t("welcome.aiTools.sequence.title")}</strong>
              <span>{t("welcome.aiTools.sequence.body")}</span>
            </div>
            <div className="welcome-ai-tool">
              <strong>{t("welcome.aiTools.timeline.title")}</strong>
              <span>{t("welcome.aiTools.timeline.body")}</span>
            </div>
            {account?.plan === "business" ? (
              <div className="welcome-ai-tool is-pro">
                <strong>{t("welcome.aiTools.pro.title")}</strong>
                <span>{t("welcome.aiTools.pro.body")}</span>
              </div>
            ) : null}
          </div>
          <Link to="/new" className="welcome-ai-tools-cta">
            {t("welcome.aiTools.cta")}
          </Link>
        </>
      ) : null}

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
