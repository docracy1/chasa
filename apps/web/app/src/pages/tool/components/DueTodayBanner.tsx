import { Link } from "react-router-dom";
import type { ChaseReminder } from "../../../lib/api";
import { formatUsDate } from "../../../lib/locale";
import { useT } from "../../../lib/i18n";

type DueTodayBannerProps = {
  reminders: ChaseReminder[];
  onOpenReminder: (reminder: ChaseReminder) => void;
};

export function DueTodayBanner({ reminders, onOpenReminder }: DueTodayBannerProps) {
  const t = useT();
  if (!reminders.length) return null;

  return (
    <section className="due-today-banner">
      <h2 className="welcome-section-title">
        {reminders.length === 1
          ? t("dueToday.one", { count: reminders.length })
          : t("dueToday.many", { count: reminders.length })}
      </h2>
      <p className="chase-tip">{t("dueToday.tip")}</p>
      <ul className="due-today-list">
        {reminders.map((r) => (
          <li key={r.id}>
            <button type="button" className="due-today-row" onClick={() => onOpenReminder(r)}>
              <strong>{r.clientName}</strong>
              <span>{r.label ?? t("dueToday.step", { n: r.stepNumber })}</span>
              <em>{formatUsDate(r.plannedDate)}</em>
            </button>
          </li>
        ))}
      </ul>
      <Link className="ai-unlock-link" to="/account">
        {t("dueToday.settings")}
      </Link>
    </section>
  );
}
