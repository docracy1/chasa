import { track } from "../../../lib/analytics";
import { daysOverdue } from "../../../lib/dates";
import { toneClass, toneLabel } from "../chaseTone";
import type { Invoice } from "../types";

interface AgingOverviewPanelProps {
  invoices: Invoice[];
  isPaid: boolean;
  selectedIds: Set<string>;
  selectedCount: number;
  multiBusy: boolean;
  atLimit: boolean;
  multiError: string | null;
  multiDraft: { subject: string; body: string } | null;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onMultiDraft: () => void;
  onToggleSelect: (id: string) => void;
  onScrollToInvoice: (id: string) => void;
  onGenerate: (id: string) => void;
  onMultiDraftChange: (draft: { subject: string; body: string }) => void;
}

export function AgingOverviewPanel({
  invoices,
  isPaid,
  selectedIds,
  selectedCount,
  multiBusy,
  atLimit,
  multiError,
  multiDraft,
  onSelectAll,
  onClearSelection,
  onMultiDraft,
  onToggleSelect,
  onScrollToInvoice,
  onGenerate,
  onMultiDraftChange,
}: AgingOverviewPanelProps) {
  return (
    <section className="panel aging-panel">
      <div className="aging-head">
        <div>
          <h2 className="aging-title">Aging overview</h2>
          <p className="branding-help">
            Client · amount · days overdue · last chase. Rows stay in this browser
            {isPaid ? " and sync to your Solo+ workspace" : " (re-upload CSV anytime)"}.
          </p>
        </div>
        <div className="aging-actions">
          <button type="button" className="btn-secondary" onClick={onSelectAll}>
            Select all
          </button>
          {selectedCount > 0 && (
            <button type="button" className="btn-secondary" onClick={onClearSelection}>
              Clear ({selectedCount})
            </button>
          )}
          <button
            type="button"
            className="btn-primary"
            disabled={selectedCount < 2 || multiBusy || atLimit}
            onClick={() => void onMultiDraft()}
          >
            {multiBusy ? "Writing…" : "Draft one email"}
          </button>
        </div>
      </div>
      <div className="aging-table-wrap">
        <table className="aging-table">
          <thead>
            <tr>
              <th className="aging-check" />
              <th>Client</th>
              <th>Amount</th>
              <th>Days overdue</th>
              <th>Last chase</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => {
              const days = daysOverdue(inv.dueDate);
              return (
                <tr key={inv.id} className={`aging-row ${toneClass(days)}`}>
                  <td className="aging-check">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(inv.id)}
                      onChange={() => onToggleSelect(inv.id)}
                      aria-label={`Select ${inv.clientName}`}
                    />
                  </td>
                  <td>{inv.clientName}</td>
                  <td>${inv.amount.toFixed(2)}</td>
                  <td>
                    <span className={`days-badge ${toneClass(days)}`}>
                      {days}d · {toneLabel(days)}
                    </span>
                  </td>
                  <td className="aging-status">
                    {inv.lastChaseStatus ? (
                      <>
                        {inv.lastChaseStatus}
                        {inv.lastChaseAt && (
                          <span className="aging-status-time">
                            {new Date(inv.lastChaseAt).toLocaleDateString()}
                          </span>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        onScrollToInvoice(inv.id);
                        if (!inv.draft && !atLimit) void onGenerate(inv.id);
                      }}
                    >
                      {inv.draft ? "View draft" : "Generate chase"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {multiError && <div className="error-msg">{multiError}</div>}
      {multiDraft && (
        <div className="multi-draft-box">
          <div className="ai-tools-label">Multi-invoice draft ({selectedCount} invoices)</div>
          <input
            type="text"
            className="draft-subject"
            value={multiDraft.subject}
            onChange={(e) => onMultiDraftChange({ ...multiDraft, subject: e.target.value })}
          />
          <textarea
            rows={8}
            value={multiDraft.body}
            onChange={(e) => onMultiDraftChange({ ...multiDraft, body: e.target.value })}
          />
          <div className="draft-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                navigator.clipboard.writeText(
                  `Subject: ${multiDraft.subject}\n\n${multiDraft.body}`
                );
                track("chase_sent", { method: "copy", source: "multi" });
              }}
            >
              Copy
            </button>
            <a
              className="btn-secondary"
              href={`mailto:?subject=${encodeURIComponent(multiDraft.subject)}&body=${encodeURIComponent(multiDraft.body)}`}
              onClick={() => track("chase_sent", { method: "mailto", source: "multi" })}
            >
              Open in email client
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
