import type { RewriteAction } from "../../../lib/api";
import { daysOverdue } from "../../../lib/dates";
import { chaseTip, toneClass, toneLabel } from "../chaseTone";
import type { Invoice } from "../types";

interface InvoiceCardProps {
  invoice: Invoice;
  isPaid: boolean;
  atLimit: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onGenerate: (id: string) => void;
  onUpdateDraft: (invoiceId: string, field: "subject" | "body", value: string) => void;
  onRewrite: (invoiceId: string, action: RewriteAction) => void;
  onThankYou: (invoiceId: string) => void;
  onSequence: (invoiceId: string) => void;
  onSms: (invoiceId: string) => void;
  onClientReplyChange: (invoiceId: string, value: string) => void;
  onReply: (invoiceId: string) => void;
  onApplySequenceStep: (invoiceId: string, stepIndex: number) => void;
  onCopyNextReminder: (invoice: Invoice) => void;
  onMarkReminderDone: (invoiceId: string, reminderId: string) => void;
  onCopyDraft: (invoice: Invoice) => void;
  onTrackedCopy: (invoice: Invoice) => void;
  mailtoLink: (invoice: Invoice) => string;
  onMailtoClick: (invoice?: Invoice) => void;
  sequenceSendDate: (daysFromNow: number) => string;
}

export function InvoiceCard({
  invoice,
  isPaid,
  atLimit,
  selectedIds,
  onToggleSelect,
  onGenerate,
  onUpdateDraft,
  onRewrite,
  onThankYou,
  onSequence,
  onSms,
  onClientReplyChange,
  onReply,
  onApplySequenceStep,
  onCopyNextReminder,
  onMarkReminderDone,
  onCopyDraft,
  onTrackedCopy,
  mailtoLink,
  onMailtoClick,
  sequenceSendDate,
}: InvoiceCardProps) {
  const days = daysOverdue(invoice.dueDate);
  const tone = toneClass(days);
  const busy = invoice.generating || invoice.rewriting !== null;

  return (
    <div id={`invoice-${invoice.id}`} className={`invoice-card ${tone}`}>
      <div className="invoice-top">
        <div className="invoice-top-left">
          <label className="invoice-select">
            <input
              type="checkbox"
              checked={selectedIds.has(invoice.id)}
              onChange={() => onToggleSelect(invoice.id)}
            />
            <span className="invoice-client">{invoice.clientName}</span>
          </label>
          <div className="invoice-meta">
            ${invoice.amount.toFixed(2)} · due {invoice.dueDate}
            {invoice.lastChaseStatus ? ` · last chase: ${invoice.lastChaseStatus}` : ""}
          </div>
        </div>
        <span className="days-badge">
          {toneLabel(days)} · {days} day{days === 1 ? "" : "s"} late
        </span>
      </div>

      <div className="chase-tip">{chaseTip(days)}</div>

      {!invoice.draft && (
        <button
          className="btn-primary"
          disabled={busy || atLimit}
          onClick={() => onGenerate(invoice.id)}
        >
          {invoice.generating ? "Writing…" : "Generate follow-up"}
        </button>
      )}
      {invoice.error && <div className="error-msg">{invoice.error}</div>}

      {invoice.draft && (
        <>
          <input
            type="text"
            className="draft-subject"
            value={invoice.draft.subject}
            onChange={(e) => onUpdateDraft(invoice.id, "subject", e.target.value)}
          />
          <textarea
            rows={6}
            value={invoice.draft.body}
            onChange={(e) => onUpdateDraft(invoice.id, "body", e.target.value)}
          />

          <div className={`ai-tools-inline ${isPaid ? "" : "ai-tools-locked"}`}>
            <div className="ai-tools-label">
              AI tools {isPaid ? null : <span className="paid-pill">Paid</span>}
            </div>
            {isPaid ? (
              <>
                <button
                  type="button"
                  className="ai-tool-btn"
                  disabled={busy}
                  onClick={() => onRewrite(invoice.id, "softer")}
                >
                  <span className="ai-tool-icon" aria-hidden="true">
                    ↓
                  </span>
                  <span>
                    <strong>{invoice.rewriting === "softer" ? "Softening…" : "Soften"}</strong>
                    <span>Less pressure, still asks</span>
                  </span>
                </button>
                <button
                  type="button"
                  className="ai-tool-btn"
                  disabled={busy}
                  onClick={() => onRewrite(invoice.id, "firmer")}
                >
                  <span className="ai-tool-icon" aria-hidden="true">
                    ↑
                  </span>
                  <span>
                    <strong>{invoice.rewriting === "firmer" ? "Firming…" : "Firm up"}</strong>
                    <span>Clearer urgency</span>
                  </span>
                </button>
                <button
                  type="button"
                  className="ai-tool-btn"
                  disabled={busy}
                  onClick={() => onRewrite(invoice.id, "shorter")}
                >
                  <span className="ai-tool-icon" aria-hidden="true">
                    ✂
                  </span>
                  <span>
                    <strong>
                      {invoice.rewriting === "shorter" ? "Shortening…" : "Make shorter"}
                    </strong>
                    <span>Under ~60 words</span>
                  </span>
                </button>
                <button
                  type="button"
                  className="ai-tool-btn"
                  disabled={busy}
                  onClick={() => onThankYou(invoice.id)}
                >
                  <span className="ai-tool-icon" aria-hidden="true">
                    ✓
                  </span>
                  <span>
                    <strong>
                      {invoice.rewriting === "thankyou" ? "Writing…" : "Thank-you email"}
                    </strong>
                    <span>After they paid</span>
                  </span>
                </button>
                {isPaid ? (
                  <button
                    type="button"
                    className="ai-tool-btn"
                    disabled={busy}
                    onClick={() => onSequence(invoice.id)}
                  >
                    <span className="ai-tool-icon" aria-hidden="true">
                      ⏱
                    </span>
                    <span>
                      <strong>
                        {invoice.rewriting === "sequence" ? "Planning…" : "3-step chase plan"}
                      </strong>
                      <span>Solo+ · calendar dates</span>
                    </span>
                  </button>
                ) : (
                  <a className="ai-unlock-link" href="/app/account">
                    Unlock chase plans on Solo ($7/mo) →
                  </a>
                )}
                {isPaid && (
                  <button
                    type="button"
                    className="ai-tool-btn"
                    disabled={busy}
                    onClick={() => onSms(invoice.id)}
                  >
                    <span className="ai-tool-icon" aria-hidden="true">
                      ✉
                    </span>
                    <span>
                      <strong>
                        {invoice.rewriting === "sms" ? "Writing…" : "SMS / WhatsApp draft"}
                      </strong>
                      <span>Copy or open — never auto-sent</span>
                    </span>
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="ai-tool-btn ai-tool-teaser" aria-disabled="true">
                  <span className="ai-tool-icon" aria-hidden="true">
                    ↓
                  </span>
                  <span>
                    <strong>Soften</strong>
                    <span>Less pressure, still asks</span>
                  </span>
                </div>
                <div className="ai-tool-btn ai-tool-teaser" aria-disabled="true">
                  <span className="ai-tool-icon" aria-hidden="true">
                    ↑
                  </span>
                  <span>
                    <strong>Firm up</strong>
                    <span>Clearer urgency</span>
                  </span>
                </div>
                <div className="ai-tool-btn ai-tool-teaser" aria-disabled="true">
                  <span className="ai-tool-icon" aria-hidden="true">
                    ✂
                  </span>
                  <span>
                    <strong>Make shorter</strong>
                    <span>Under ~60 words</span>
                  </span>
                </div>
                <a className="ai-unlock-link" href="/app/account">
                  Unlock AI tools from Solo ($7/mo) →
                </a>
              </>
            )}
          </div>

          {isPaid && (
            <div className="reply-box">
              <label className="ai-tools-label">Client replied? Paste it — AI drafts your answer</label>
              <textarea
                rows={3}
                placeholder="Paste their email reply here…"
                value={invoice.clientReply ?? ""}
                onChange={(e) => onClientReplyChange(invoice.id, e.target.value)}
              />
              <button
                type="button"
                className="btn-secondary"
                disabled={busy || !invoice.clientReply?.trim()}
                onClick={() => onReply(invoice.id)}
              >
                {invoice.rewriting === "reply" ? "Writing reply…" : "Draft reply"}
              </button>
            </div>
          )}

          {invoice.sequence && (
            <div className="sequence-box">
              <div className="ai-tools-label">Chase plan calendar</div>
              <p className="chase-tip">{invoice.sequence.tip}</p>
              <div className="sequence-steps">
                {invoice.sequence.steps.map((step, idx) => (
                  <button
                    key={step.step}
                    type="button"
                    className="sequence-step"
                    onClick={() => onApplySequenceStep(invoice.id, idx)}
                  >
                    <strong>
                      Step {step.step}
                      {step.daysFromNow === 0
                        ? " · send today"
                        : ` · ${sequenceSendDate(step.daysFromNow)}`}
                    </strong>
                    <span>{step.label}</span>
                    <span className="sequence-step-date">
                      {step.daysFromNow === 0
                        ? "Today"
                        : `In ${step.daysFromNow} day${step.daysFromNow === 1 ? "" : "s"}`}
                    </span>
                  </button>
                ))}
              </div>
              {invoice.reminders && invoice.reminders.length > 0 && (
                <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => onCopyNextReminder(invoice)}
                  >
                    Copy next
                  </button>
                  {invoice.reminders
                    .filter((r) => r.status === "planned")
                    .slice(0, 1)
                    .map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        className="btn-secondary"
                        onClick={() => onMarkReminderDone(invoice.id, r.id)}
                      >
                        Mark step done
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}

          {invoice.smsDraft && (
            <div className="sequence-box">
              <div className="ai-tools-label">SMS / WhatsApp (you send)</div>
              <p className="chase-tip">{invoice.smsDraft.sms}</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => navigator.clipboard.writeText(invoice.smsDraft!.sms)}
                >
                  Copy SMS
                </button>
                <a className="btn-secondary" href={invoice.smsDraft.smsUri}>
                  Open SMS
                </a>
              </div>
              <p className="chase-tip">{invoice.smsDraft.whatsapp}</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => navigator.clipboard.writeText(invoice.smsDraft!.whatsapp)}
                >
                  Copy WhatsApp
                </button>
                <a
                  className="btn-secondary"
                  href={invoice.smsDraft.whatsappUri}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open WhatsApp
                </a>
              </div>
            </div>
          )}

          <div className="draft-actions">
            <button className="btn-secondary" onClick={() => onCopyDraft(invoice)}>
              Copy
            </button>
            {isPaid && (
              <button className="btn-secondary" onClick={() => onTrackedCopy(invoice)}>
                Copy tracked HTML
              </button>
            )}
            <a
              className="btn-secondary"
              href={mailtoLink(invoice)}
              onClick={() => onMailtoClick(invoice)}
            >
              Open in email client
            </a>
            <button
              className="btn-secondary"
              disabled={busy || atLimit}
              onClick={() => onGenerate(invoice.id)}
            >
              {invoice.generating ? "Writing…" : "Regenerate"}
            </button>
          </div>
          {invoice.trackingNote && (
            <p className="chase-tip" style={{ marginTop: 8 }}>
              {invoice.trackingNote}
            </p>
          )}
        </>
      )}
    </div>
  );
}
