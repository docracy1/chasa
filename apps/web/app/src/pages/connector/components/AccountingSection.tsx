import { Link } from "react-router-dom";
import {
  ACCOUNTING_REDIRECT_URIS,
  ACCOUNTING_SECRET_NAMES,
  accountingConnectUrl,
  type AccountingConnectorStatus,
  type AccountingProvider,
} from "../../../lib/api";
import { ACCOUNTING_CONSOLE, ACCOUNTING_LABELS, ACCOUNTING_PROVIDERS } from "../constants";
import { ACCOUNTING_DESCRIPTION_KEYS } from "../descriptions";
import { useT } from "../../../lib/i18n";
import { StatusPill } from "./StatusPill";

type AccountingSectionProps = {
  isPaid: boolean;
  statusLoaded: boolean;
  accounting: AccountingConnectorStatus[];
  accountingBusy: AccountingProvider | null;
  onImport: (provider: AccountingProvider) => void;
  onDisconnect: (provider: AccountingProvider) => void;
};

export function AccountingSection({
  isPaid,
  statusLoaded,
  accounting,
  accountingBusy,
  onImport,
  onDisconnect,
}: AccountingSectionProps) {
  const t = useT();

  return (
    <section className="branding-card" style={{ marginTop: 20 }}>
      <h2 className="webhooks-title" style={{ fontSize: "1.25rem" }}>
        {t("connector.accountingTitle")}
      </h2>
      <p className="branding-help">{t("connector.accountingBody")}</p>
      <ol className="connector-how-list">
        <li>{t("connector.accountingHow1")}</li>
        <li>{t("connector.accountingHow2")}</li>
        <li>{t("connector.accountingHow3")}</li>
      </ol>
      {!isPaid && (
        <div className="upgrade-nudge">
          {t("connector.accountingUpgrade")}{" "}
          <Link to="/account">{t("connector.upgradeLink")}</Link>
        </div>
      )}
      <ul className="cloud-connector-list connector-cards">
        {ACCOUNTING_PROVIDERS.map((p) => {
          const st =
            accounting.find((a) => a.provider === p) ??
            ({
              provider: p,
              connected: false,
              externalEmail: null,
              realmId: null,
              connectedAt: null,
              configured: true,
            } as AccountingConnectorStatus);
          const secretsMissing = statusLoaded && !st.configured;
          const consoleInfo = ACCOUNTING_CONSOLE[p];
          return (
            <li key={p} className="cloud-connector-row connector-card">
              <div className="cloud-connector-meta">
                <strong>{ACCOUNTING_LABELS[p]}</strong>
                <p className="connector-card-desc">{t(ACCOUNTING_DESCRIPTION_KEYS[p])}</p>
                <div className="connector-checklist-marks">
                  <StatusPill kind={secretsMissing ? "warn" : "ok"}>
                    {secretsMissing
                      ? t("connector.secretsMissing")
                      : statusLoaded
                        ? t("connector.configured")
                        : "…"}
                  </StatusPill>
                  <StatusPill kind={st.connected ? "ok" : "muted"}>
                    {st.connected ? t("connector.connected") : t("connector.notConnected")}
                  </StatusPill>
                </div>
              </div>
              <div className="cloud-connector-actions">
                {isPaid && !st.connected && st.configured && (
                  <a className="btn-primary" href={accountingConnectUrl(p)}>
                    {t("common.connect")}
                  </a>
                )}
                {isPaid && !st.connected && secretsMissing && (
                  <span className="btn-secondary cloud-connector-disabled" aria-disabled>
                    {t("connector.connectUnavailable")}
                  </span>
                )}
                {isPaid && st.connected && (
                  <>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={accountingBusy !== null}
                      onClick={() => onImport(p)}
                    >
                      {accountingBusy === p ? t("connector.importing") : t("connector.importOverdue")}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={accountingBusy !== null}
                      onClick={() => onDisconnect(p)}
                    >
                      {t("common.disconnect")}
                    </button>
                  </>
                )}
              </div>
              {isPaid && secretsMissing && (
                <div className="connector-secret-help">
                  <p>
                    <strong>Set secrets</strong> for {ACCOUNTING_LABELS[p]} — same pattern as cloud
                    connectors. Create the app yourself; we cannot invent client secrets.
                  </p>
                  <ol>
                    <li>
                      In{" "}
                      <a href={consoleInfo.href} target="_blank" rel="noopener noreferrer">
                        {consoleInfo.label}
                      </a>
                      , create an app and register redirect URI:
                      <pre className="connector-pre">{ACCOUNTING_REDIRECT_URIS[p]}</pre>
                    </li>
                    <li>
                      {p === "quickbooks" ? (
                        <>
                          Scope: <code>com.intuit.quickbooks.accounting</code>
                        </>
                      ) : (
                        <>
                          Scopes: accounting transactions/contacts read + <code>offline_access</code>
                        </>
                      )}
                    </li>
                    <li>
                      From <code>apps/worker</code>:
                      <pre className="connector-pre">{`wrangler secret put ${ACCOUNTING_SECRET_NAMES[p][0]}
wrangler secret put ${ACCOUNTING_SECRET_NAMES[p][1]}`}</pre>
                    </li>
                    <li>Redeploy the worker, refresh, then Connect → Import overdue.</li>
                  </ol>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
