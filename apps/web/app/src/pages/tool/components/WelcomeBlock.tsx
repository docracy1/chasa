import { Link } from "react-router-dom";
import { FREE_LIMIT } from "../../../lib/usage";
import type { Account } from "../../../lib/api";

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
  return (
    <section className="welcome-block">
      <h1>{welcomeName ? `Welcome, ${welcomeName}` : "Welcome"}</h1>
      <p className="page-sub" style={{ marginBottom: 0 }}>
        Here&apos;s what needs your attention today.
      </p>

      <div className="welcome-attention">
        <div className={`welcome-stat${overdueCount > 0 ? " is-accent" : ""}`}>
          <span className="welcome-stat-label">Overdue invoices</span>
          <strong>{overdueCount}</strong>
          <em>{invoiceCount === 0 ? "Add invoices to begin" : "In this workspace"}</em>
        </div>
        <div className="welcome-stat">
          <span className="welcome-stat-label">Drafts ready</span>
          <strong>{draftedCount}</strong>
          <em>Never auto-sent</em>
        </div>
        <div className="welcome-stat">
          <span className="welcome-stat-label">{isPaid ? "Plan" : "Free drafts"}</span>
          <strong>{isPaid ? account?.plan ?? "paid" : `${Math.max(0, FREE_LIMIT - usedCount)}`}</strong>
          <em>{isPaid ? "All features unlocked" : `of ${FREE_LIMIT} left this month`}</em>
        </div>
      </div>

      <h2 className="welcome-section-title">Start something new</h2>
      <div className="welcome-actions">
        <a className="welcome-action" href="#chase-workspace">
          <span className="welcome-action-icon" aria-hidden="true">
            +
          </span>
          <span>
            <strong>New chase</strong>
            <span>Paste invoices or add a row, write drafts</span>
          </span>
        </a>
        <a className="welcome-action" href="#chase-workspace">
          <span className="welcome-action-icon" aria-hidden="true">
            ↗
          </span>
          <span>
            <strong>Import CSV</strong>
            <span>QuickBooks, FreshBooks, Xero, Wave…</span>
          </span>
        </a>
        <Link className="welcome-action" to="/connector">
          <span className="welcome-action-icon" aria-hidden="true">
            ≡
          </span>
          <span>
            <strong>Connectors</strong>
            <span>Dropbox, OneDrive, Box, or API keys</span>
          </span>
        </Link>
        <Link className="welcome-action" to={isPaid ? "/clients" : "/account"}>
          <span className="welcome-action-icon" aria-hidden="true">
            ▤
          </span>
          <span>
            <strong>Aging &amp; clients</strong>
            <span>{isPaid ? "Track outstanding balances" : "Unlock on Solo+"}</span>
          </span>
        </Link>
      </div>

      <h2 className="welcome-section-title">Needs attention</h2>
      {overdueCount === 0 ? (
        <div className="welcome-quiet">
          <span className="welcome-quiet-check" aria-hidden="true">
            ✓
          </span>
          <span>
            <strong>You&apos;re all caught up. Smooth.</strong>
            <span>
              {invoiceCount === 0
                ? "Nothing overdue yet — import a CSV or add an invoice below."
                : "No overdue invoices waiting on a chase right now."}
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
              {overdueCount} overdue invoice{overdueCount === 1 ? "" : "s"}
            </strong>
            <span>Scroll to the aging table or draft follow-ups below.</span>
          </span>
        </div>
      )}
    </section>
  );
}
