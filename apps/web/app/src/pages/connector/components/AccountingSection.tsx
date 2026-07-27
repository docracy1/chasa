import { Link } from "react-router-dom";
import {
  ACCOUNTING_REDIRECT_URIS,
  ACCOUNTING_SECRET_NAMES,
  accountingConnectUrl,
  type AccountingConnectorStatus,
  type AccountingProvider,
} from "../../../lib/api";
import { ACCOUNTING_CONSOLE, ACCOUNTING_LABELS, ACCOUNTING_PROVIDERS } from "../constants";
import { ACCOUNTING_DESCRIPTIONS } from "../descriptions";
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
  return (
    <section className="branding-card" style={{ marginTop: 20 }}>
      <h2 className="webhooks-title" style={{ fontSize: "1.25rem" }}>
        QuickBooks Online &amp; Xero
      </h2>
      <p className="branding-help">
        Use this when you invoice in QuickBooks or Xero. Chasa imports <strong>overdue</strong>{" "}
        invoices into your aging list so you can draft chase emails in the Tool — never auto-sent.
      </p>
      <ol className="connector-how-list">
        <li>
          Click <strong>Connect</strong> and sign in to QuickBooks or Xero
        </li>
        <li>
          Click <strong>Import overdue</strong> to pull open late invoices into Chasa
        </li>
        <li>
          Open the <a href="/app/">Tool</a> (or Clients) and generate follow-ups
        </li>
      </ol>
      {!isPaid && (
        <div className="upgrade-nudge">
          Native QBO / Xero is on Solo and up. <Link to="/account">Upgrade</Link>
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
                <p className="connector-card-desc">{ACCOUNTING_DESCRIPTIONS[p]}</p>
                <div className="connector-checklist-marks">
                  <StatusPill kind={secretsMissing ? "warn" : "ok"}>
                    {secretsMissing ? "Secrets missing" : statusLoaded ? "Configured" : "…"}
                  </StatusPill>
                  <StatusPill kind={st.connected ? "ok" : "muted"}>
                    {st.connected ? "Connected" : "Not connected"}
                  </StatusPill>
                </div>
              </div>
              <div className="cloud-connector-actions">
                {isPaid && !st.connected && st.configured && (
                  <a className="btn-primary" href={accountingConnectUrl(p)}>
                    Connect
                  </a>
                )}
                {isPaid && !st.connected && secretsMissing && (
                  <span className="btn-secondary cloud-connector-disabled" aria-disabled>
                    Connect unavailable
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
                      {accountingBusy === p ? "Importing…" : "Import overdue"}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={accountingBusy !== null}
                      onClick={() => onDisconnect(p)}
                    >
                      Disconnect
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
