import {
  ACCOUNTING_REDIRECT_URIS,
  ACCOUNTING_SECRET_NAMES,
  CLOUD_REDIRECT_URIS,
  CLOUD_SECRET_NAMES,
  type AccountingConnectorStatus,
  type CloudConnectorStatus,
  type CloudProvider,
} from "../../../lib/api";
import { CLOUD_LABELS } from "../../../lib/cloudImport";
import { ACCOUNTING_LABELS, ACCOUNTING_PROVIDERS, PROVIDERS } from "../constants";

type OperatorNotesSectionProps = {
  statusLoaded: boolean;
  statusByProvider: Map<CloudProvider, CloudConnectorStatus>;
  accounting: AccountingConnectorStatus[];
  missingSecrets: CloudConnectorStatus[];
  keepSetupOpen: boolean;
  onCollapseNotes: () => void;
};

export function OperatorNotesSection({
  statusLoaded,
  statusByProvider,
  accounting,
  missingSecrets,
  keepSetupOpen,
  onCollapseNotes,
}: OperatorNotesSectionProps) {
  return (
    <section className="branding-card connector-operator-notes" style={{ marginTop: 20 }}>
      <h2 className="webhooks-title" style={{ fontSize: "1.25rem" }}>
        Operator notes
      </h2>
      <p className="branding-help">
        Exact redirect URIs (register in each provider console) and which secrets are still missing.
      </p>
      <table className="connector-ops-table">
        <thead>
          <tr>
            <th>Provider</th>
            <th>Redirect URI</th>
            <th>Secrets</th>
          </tr>
        </thead>
        <tbody>
          {PROVIDERS.map((p) => {
            const st = statusByProvider.get(p);
            const missing = statusLoaded && st && !st.configured;
            return (
              <tr key={p}>
                <td>{CLOUD_LABELS[p]}</td>
                <td>
                  <code>{CLOUD_REDIRECT_URIS[p]}</code>
                </td>
                <td>
                  {missing ? (
                    <span className="connector-pill connector-pill-warn">
                      Missing {CLOUD_SECRET_NAMES[p].join(" + ")}
                    </span>
                  ) : statusLoaded ? (
                    <span className="connector-pill connector-pill-ok">Set</span>
                  ) : (
                    <span className="connector-pill connector-pill-muted">…</span>
                  )}
                </td>
              </tr>
            );
          })}
          {ACCOUNTING_PROVIDERS.map((p) => {
            const st = accounting.find((a) => a.provider === p);
            const missing = statusLoaded && st && !st.configured;
            const secrets = ACCOUNTING_SECRET_NAMES[p].join(" + ");
            return (
              <tr key={p}>
                <td>{ACCOUNTING_LABELS[p]}</td>
                <td>
                  <code>{ACCOUNTING_REDIRECT_URIS[p]}</code>
                </td>
                <td>
                  {missing ? (
                    <span className="connector-pill connector-pill-warn">Missing {secrets}</span>
                  ) : st ? (
                    <span className="connector-pill connector-pill-ok">
                      {st.configured ? "Set" : "Missing"}
                    </span>
                  ) : (
                    <span className="connector-pill connector-pill-muted">…</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {missingSecrets.length > 0 && (
        <div className="connector-secret-help" style={{ marginTop: 14 }}>
          <p>
            <strong>Still missing</strong> (
            {missingSecrets.map((s) => CLOUD_LABELS[s.provider]).join(", ")}):
          </p>
          <pre className="connector-pre">
            {missingSecrets
              .flatMap((s) => CLOUD_SECRET_NAMES[s.provider].map((n) => `wrangler secret put ${n}`))
              .join("\n")}
          </pre>
        </div>
      )}
      {statusLoaded && accounting.some((a) => !a.configured) && (
        <div className="connector-secret-help" style={{ marginTop: 14 }}>
          <p>
            <strong>Accounting secrets still missing</strong> (
            {accounting
              .filter((a) => !a.configured)
              .map((a) => ACCOUNTING_LABELS[a.provider])
              .join(", ")}
            ):
          </p>
          <pre className="connector-pre">
            {accounting
              .filter((a) => !a.configured)
              .flatMap((a) =>
                ACCOUNTING_SECRET_NAMES[a.provider].map((n) => `wrangler secret put ${n}`)
              )
              .join("\n")}
          </pre>
        </div>
      )}
      {missingSecrets.length === 0 && statusLoaded && (
        <p className="branding-help">
          All three OAuth secret pairs look configured on this worker.
        </p>
      )}
      {!keepSetupOpen && (
        <button
          type="button"
          className="btn-secondary"
          style={{ marginTop: 12 }}
          onClick={onCollapseNotes}
        >
          Collapse operator notes
        </button>
      )}
    </section>
  );
}
