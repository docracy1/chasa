import { Link } from "react-router-dom";
import type { ConnectorKey } from "../../../lib/api";
import { DRAFT_URL } from "../constants";
import { sampleCurlDisplay } from "../utils";

type ApiKeySectionProps = {
  isPaid: boolean;
  loading: boolean;
  busy: boolean;
  keys: ConnectorKey[];
  newToken: string | null;
  copied: boolean;
  copiedCurl: boolean;
  adding: boolean;
  name: string;
  onCreateTestKey: () => void;
  onCopyCurl: () => void;
  onCopyToken: () => void;
  onDismissToken: () => void;
  onRevoke: (id: string) => void;
  onStartAdding: () => void;
  onNameChange: (name: string) => void;
  onCreate: (e: React.FormEvent) => void;
  onCancelAdding: () => void;
};

export function ApiKeySection({
  isPaid,
  loading,
  busy,
  keys,
  newToken,
  copied,
  copiedCurl,
  adding,
  name,
  onCreateTestKey,
  onCopyCurl,
  onCopyToken,
  onDismissToken,
  onRevoke,
  onStartAdding,
  onNameChange,
  onCreate,
  onCancelAdding,
}: ApiKeySectionProps) {
  return (
    <section className="branding-card" style={{ marginTop: 20 }}>
      <h1 className="webhooks-title" style={{ fontSize: "1.25rem" }}>
        Zapier / API key
      </h1>
      <p className="branding-help">
        Create a test key, then copy the <strong>full curl command</strong> (not the key alone) to
        call <code>POST /api/v1/chase/draft</code>. Draft only — Chasa never emails your client.
      </p>

      {!isPaid && (
        <div className="upgrade-nudge">
          Zapier / Make API keys are on Solo ($7), Pro ($17), and Enterprise.{" "}
          <Link to="/account">Upgrade</Link>.
        </div>
      )}

      {isPaid && (
        <div className="connector-zapier-actions">
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={onCreateTestKey}
          >
            {busy ? "Creating…" : "Create test key"}
          </button>
          <a
            className="btn-secondary"
            href="/docs/zapier-overdue-import.json"
            download="chasa-freshbooks-zapier.json"
          >
            FreshBooks Zap
          </a>
          <a
            className="btn-secondary"
            href="/docs/zapier-wave-overdue-import.json"
            download="chasa-wave-zapier.json"
          >
            Wave Zap
          </a>
          <a
            className="btn-secondary"
            href="/docs/zapier-zoho-overdue-import.json"
            download="chasa-zoho-zapier.json"
          >
            Zoho Books Zap
          </a>
        </div>
      )}

      {newToken && (
        <div className="connector-token-once">
          <p className="connector-curl-warn">
            <strong>Run the entire curl line in Terminal</strong> — do <em>not</em> paste the API key
            by itself. A bare key is not a shell command (that often prints{" "}
            <code>command not found: chasa_…</code>).
          </p>
          <p>
            <strong>1. Preferred — copy full curl</strong> (includes the key safely inside{" "}
            <code>Authorization: Bearer …</code>):
          </p>
          <pre className="connector-pre connector-pre-curl">{sampleCurlDisplay(newToken)}</pre>
          <div className="connector-token-actions">
            <button type="button" className="btn-primary" onClick={onCopyCurl}>
              {copiedCurl ? "Copied full curl ✓" : "Copy full curl command"}
            </button>
            <button type="button" className="btn-secondary" onClick={onDismissToken}>
              Done
            </button>
          </div>
          {copiedCurl && (
            <p className="connector-test-ok-line" style={{ marginTop: 10 }}>
              Paste into Terminal and press Return — run that entire line.
            </p>
          )}
          <details className="connector-key-only">
            <summary>Need the raw key for Zapier’s password / token field?</summary>
            <p className="branding-help">
              Use this only in Zapier/Make auth fields — never as a Terminal command.
            </p>
            <code className="connector-token">{newToken}</code>
            <button type="button" className="btn-secondary" onClick={onCopyToken}>
              {copied ? "Copied key only" : "Copy key only"}
            </button>
          </details>
        </div>
      )}

      {loading ? (
        <p className="page-sub">Loading…</p>
      ) : keys.length === 0 && !newToken ? (
        <p className="webhooks-empty">No API keys yet.</p>
      ) : (
        <ul className="webhooks-list">
          {keys.map((k) => (
            <li key={k.id}>
              <div className="connector-key-meta">
                <code>{k.prefix}…</code>
                <span className="connector-key-detail">
                  {k.name} · created {new Date(k.createdAt).toLocaleDateString()}
                  {k.lastUsedAt
                    ? ` · last used ${new Date(k.lastUsedAt).toLocaleDateString()}`
                    : " · never used"}
                </span>
              </div>
              {isPaid && (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => onRevoke(k.id)}
                >
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isPaid && !adding && !newToken && (
        <button type="button" className="btn-secondary" onClick={onStartAdding}>
          + Create named API key
        </button>
      )}

      {isPaid && adding && (
        <form className="webhooks-add" onSubmit={onCreate}>
          <input
            type="text"
            placeholder="Name (optional) — e.g. Zapier"
            value={name}
            maxLength={40}
            onChange={(e) => onNameChange(e.target.value)}
            disabled={busy}
          />
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Creating…" : "Create"}
          </button>
          <button type="button" className="btn-secondary" disabled={busy} onClick={onCancelAdding}>
            Cancel
          </button>
        </form>
      )}

      <div className="webhooks-events">
        <h2>Endpoint</h2>
        <p className="connector-endpoint">
          <code>POST {DRAFT_URL}</code>
        </p>
        <pre className="connector-pre">{`{
  "client_name": "Acme LLC",
  "invoice_amount": 1250,
  "days_overdue": 14
}`}</pre>
      </div>
    </section>
  );
}
