import { formatUsDateTime } from "../../../lib/locale";
import type { ChaseEventRecord } from "../../../lib/api";

const EVENT_LABELS: Record<string, string> = {
  drafted: "Draft created",
  sent: "Marked sent",
  copied: "Copied to clipboard",
  mailto: "Opened in mail app",
  marked_paid: "Marked paid",
  reply_detected: "Client reply detected",
  note: "Note",
};

export function ChaseTimeline({ events }: { events: ChaseEventRecord[] }) {
  if (!events.length) return null;
  return (
    <div className="chase-timeline">
      <div className="ai-tools-label">Chase timeline</div>
      <ul className="chase-timeline-list">
        {events.map((ev) => (
          <li key={ev.id}>
            <strong>{EVENT_LABELS[ev.eventType] ?? ev.eventType}</strong>
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
