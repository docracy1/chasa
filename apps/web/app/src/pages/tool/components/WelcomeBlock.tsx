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

const PRODUCTS = [
  {
    to: "/document-templates",
    icon: "▤",
    titleKey: "welcome.product.templates.title",
    bodyKey: "welcome.product.templates.body",
    ctaKey: "welcome.product.templates.cta",
  },
  {
    to: "/invoices",
    icon: "☰",
    titleKey: "welcome.product.invoices.title",
    bodyKey: "welcome.product.invoices.body",
    ctaKey: "welcome.product.invoices.cta",
  },
  {
    to: "/ssl-domains",
    icon: "◎",
    titleKey: "welcome.product.ssl.title",
    bodyKey: "welcome.product.ssl.body",
    ctaKey: "welcome.product.ssl.cta",
  },
  {
    to: "/certificates",
    icon: "◆",
    titleKey: "welcome.product.certificates.title",
    bodyKey: "welcome.product.certificates.body",
    ctaKey: "welcome.product.certificates.cta",
  },
  {
    to: "/?view=overdue",
    icon: "↗",
    titleKey: "welcome.product.chases.title",
    bodyKey: "welcome.product.chases.body",
    ctaKey: "welcome.product.chases.cta",
  },
] as const;

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

      <h2 className="welcome-section-title">{t("welcome.productsTitle")}</h2>
      <div className="welcome-products">
        {PRODUCTS.map((p) => (
          <Link key={p.to} className="welcome-product" to={p.to}>
            <span className="welcome-action-icon" aria-hidden="true">
              {p.icon}
            </span>
            <span className="welcome-product-copy">
              <strong>{t(p.titleKey)}</strong>
              <span>{t(p.bodyKey)}</span>
              <em>{t(p.ctaKey)}</em>
            </span>
          </Link>
        ))}
      </div>

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
