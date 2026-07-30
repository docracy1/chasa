import { formatUsDateTime } from "../../../lib/locale";
import type { ChaseEventRecord } from "../../../lib/api";
import { useT } from "../../../lib/i18n";

const EVENT_KEYS: Record<string, string> = {
  drafted: "timeline.drafted",
  sent: "timeline.sent",
  copied: "timeline.copied",
  mailto: "timeline.mailto",
  marked_paid: "timeline.marked_paid",
  reply_detected: "timeline.reply_detected",
  note: "timeline.note",
};

export function ChaseTimeline({ events }: { events: ChaseEventRecord[] }) {
  const t = useT();
  if (!events.length) return null;
  return (
    <div className="chase-timeline">
      <div className="ai-tools-label">{t("timeline.title")}</div>
      <ul className="chase-timeline-list">
        {events.map((ev) => (
          <li key={ev.id}>
            <strong>{EVENT_KEYS[ev.eventType] ? t(EVENT_KEYS[ev.eventType]) : ev.eventType}</strong>
            <span className="chase-timeline-meta">
              {formatUsDateTime(ev.createdAt)}
              {ev.subject ? ` · ${ev.subject}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
