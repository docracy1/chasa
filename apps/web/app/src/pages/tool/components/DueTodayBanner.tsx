import { Link } from "react-router-dom";
import type { ChaseReminder } from "../../../lib/api";
import { formatUsDate } from "../../../lib/locale";

type DueTodayBannerProps = {
  reminders: ChaseReminder[];
  onOpenReminder: (reminder: ChaseReminder) => void;
};

export function DueTodayBanner({ reminders, onOpenReminder }: DueTodayBannerProps) {
  if (!reminders.length) return null;

  return (
    <section className="due-today-banner">
      <h2 className="welcome-section-title">
        {reminders.length} chase step{reminders.length === 1 ? "" : "s"} due today
      </h2>
      <p className="chase-tip">
        Review each draft and send from your inbox — Chasa never auto-sends. Your daily digest uses
        the same approve-to-send flow.
      </p>
      <ul className="due-today-list">
        {reminders.map((r) => (
          <li key={r.id}>
            <button type="button" className="due-today-row" onClick={() => onOpenReminder(r)}>
              <strong>{r.clientName}</strong>
              <span>{r.label ?? `Step ${r.stepNumber}`}</span>
              <em>{formatUsDate(r.plannedDate)}</em>
            </button>
          </li>
        ))}
      </ul>
      <Link className="ai-unlock-link" to="/account">
        Daily digest settings →
      </Link>
    </section>
  );
}
