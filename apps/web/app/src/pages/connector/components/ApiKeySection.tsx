import { Link } from "react-router-dom";
import type { ConnectorKey } from "../../../lib/api";
import { useT } from "../../../lib/i18n";
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
  const t = useT();

  return (
    <section className="branding-card" style={{ marginTop: 20 }}>
      <h1 className="webhooks-title" style={{ fontSize: "1.25rem" }}>
        {t("connector.apiTitle")}
      </h1>
      <p className="branding-help">{t("connector.apiBody")}</p>
      <ol className="connector-how-list">
        <li>{t("connector.apiHow1")}</li>
        <li>{t("connector.apiHow2")}</li>
        <li>{t("connector.apiHow3")}</li>
        <li>{t("connector.apiHow4")}</li>
      </ol>

      {!isPaid && (
        <div className="upgrade-nudge">
          {t("connector.apiUpgrade")}{" "}
          <Link to="/account">{t("connector.upgradeLink")}</Link>.
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
            {busy ? t("connector.creating") : t("connector.createTestKey")}
          </button>
          <a
            className="btn-secondary"
            href="/docs/zapier-overdue-import.json"
            download="chasa-freshbooks-zapier.json"
          >
            {t("connector.freshbooksZap")}
          </a>
          <a
            className="btn-secondary"
            href="/docs/zapier-wave-overdue-import.json"
            download="chasa-wave-zapier.json"
          >
            {t("connector.waveZap")}
          </a>
          <a
            className="btn-secondary"
            href="/docs/zapier-zoho-overdue-import.json"
            download="chasa-zoho-zapier.json"
          >
            {t("connector.zohoZap")}
          </a>
        </div>
      )}

      {newToken && (
        <div className="connector-token-once">
          <p className="connector-curl-warn">{t("connector.curlWarn")}</p>
          <p>{t("connector.curlPreferred")}</p>
          <pre className="connector-pre connector-pre-curl">{sampleCurlDisplay(newToken)}</pre>
          <div className="connector-token-actions">
            <button type="button" className="btn-primary" onClick={onCopyCurl}>
              {copiedCurl ? t("connector.copiedFullCurl") : t("connector.copyFullCurlCmd")}
            </button>
            <button type="button" className="btn-secondary" onClick={onDismissToken}>
              {t("common.done")}
            </button>
          </div>
          {copiedCurl && (
            <p className="connector-test-ok-line" style={{ marginTop: 10 }}>
              {t("connector.pasteTerminal")}
            </p>
          )}
          <details className="connector-key-only">
            <summary>{t("connector.rawKeySummary")}</summary>
            <p className="branding-help">{t("connector.rawKeyHelp")}</p>
            <code className="connector-token">{newToken}</code>
            <button type="button" className="btn-secondary" onClick={onCopyToken}>
              {copied ? t("connector.copiedKeyOnly") : t("connector.copyKeyOnly")}
            </button>
          </details>
        </div>
      )}

      {loading ? (
        <p className="page-sub">{t("common.loading")}</p>
      ) : keys.length === 0 && !newToken ? (
        <p className="webhooks-empty">{t("connector.noApiKeys")}</p>
      ) : (
        <ul className="webhooks-list">
          {keys.map((k) => (
            <li key={k.id}>
              <div className="connector-key-meta">
                <code>{k.prefix}…</code>
                <span className="connector-key-detail">
                  {k.name} · {t("connector.keyCreatedAt")}{" "}
                  {new Date(k.createdAt).toLocaleDateString()}
                  {k.lastUsedAt
                    ? ` · ${t("connector.keyLastUsed")} ${new Date(k.lastUsedAt).toLocaleDateString()}`
                    : ` · ${t("connector.keyNeverUsed")}`}
                </span>
              </div>
              {isPaid && (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => onRevoke(k.id)}
                >
                  {t("connector.revoke")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isPaid && !adding && !newToken && (
        <button type="button" className="btn-secondary" onClick={onStartAdding}>
          {t("connector.createNamedKey")}
        </button>
      )}

      {isPaid && adding && (
        <form className="webhooks-add" onSubmit={onCreate}>
          <input
            type="text"
            placeholder={t("connector.keyNamePlaceholder")}
            value={name}
            maxLength={40}
            onChange={(e) => onNameChange(e.target.value)}
            disabled={busy}
          />
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? t("connector.creating") : t("connector.create")}
          </button>
          <button type="button" className="btn-secondary" disabled={busy} onClick={onCancelAdding}>
            {t("common.cancel")}
          </button>
        </form>
      )}

      <div className="webhooks-events">
        <h2>{t("connector.endpoint")}</h2>
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
