import {
  CLOUD_REDIRECT_URIS,
  CLOUD_SECRET_NAMES,
  cloudConnectorConnectUrl,
  type CloudConnectorStatus,
  type CloudProvider,
} from "../../../lib/api";
import { CLOUD_LABELS } from "../../../lib/cloudImport";
import { CLOUD_DESCRIPTION_KEYS } from "../descriptions";
import { useT } from "../../../lib/i18n";
import { ONEDRIVE_REDIRECT } from "../constants";
import type { ProviderTests } from "../types";
import { StatusPill } from "./StatusPill";

type CloudConnectorCardProps = {
  connector: CloudConnectorStatus;
  test: ProviderTests[CloudProvider];
  statusLoaded: boolean;
  isPaid: boolean;
  busy: boolean;
  testingProvider: CloudProvider | null;
  filesBusy: boolean;
  filesProvider: CloudProvider | null;
  onTest: (provider: CloudProvider) => void;
  onListFiles: (provider: CloudProvider) => void;
  onDisconnect: (provider: CloudProvider) => void;
};

export function CloudConnectorCard({
  connector: c,
  test: testState,
  statusLoaded,
  isPaid,
  busy,
  testingProvider,
  filesBusy,
  filesProvider,
  onTest,
  onListFiles,
  onDisconnect,
}: CloudConnectorCardProps) {
  const t = useT();
  const configured = !statusLoaded || c.configured;
  const lastError =
    testState.status === "fail"
      ? testState.message
      : !configured
        ? t("connector.oauthSecretsMissing")
        : null;

  return (
    <li className="cloud-connector-row connector-card">
      <div className="cloud-connector-meta">
        <strong>{CLOUD_LABELS[c.provider]}</strong>
        <p className="connector-card-desc">{t(CLOUD_DESCRIPTION_KEYS[c.provider])}</p>
        <div className="connector-checklist-marks">
          <StatusPill kind={configured ? "ok" : "warn"}>
            {configured ? t("connector.configured") : t("connector.secretsMissing")}
          </StatusPill>
          <StatusPill kind={c.connected ? "ok" : "muted"}>
            {c.connected
              ? `${t("connector.connected")}${c.externalEmail ? ` · ${c.externalEmail}` : ""}`
              : t("connector.notConnected")}
          </StatusPill>
          <StatusPill
            kind={testState.status === "ok" ? "ok" : testState.status === "fail" ? "fail" : "muted"}
          >
            {testState.status === "ok"
              ? t("connector.testOk")
              : testState.status === "running"
                ? t("common.testing")
                : testState.status === "fail"
                  ? t("connector.testFail")
                  : t("connector.testPending")}
          </StatusPill>
        </div>
        {c.connected && c.connectedAt && (
          <span className="connector-key-detail">
            {t("connector.since", { date: new Date(c.connectedAt).toLocaleDateString() })}
          </span>
        )}
        {lastError && (
          <p className="connector-last-error">
            {t("connector.lastError", { error: lastError })}
            {testState.hint ? ` — ${testState.hint}` : ""}
          </p>
        )}
        {testState.status === "ok" && testState.message && (
          <p className="connector-test-ok-line">{testState.message}</p>
        )}
      </div>
      <div className="cloud-connector-actions">
        {isPaid && c.connected && (
          <>
            <button
              type="button"
              className="btn-primary"
              disabled={testingProvider !== null}
              onClick={() => onTest(c.provider)}
            >
              {testingProvider === c.provider ? t("common.testing") : t("common.test")}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={filesBusy}
              onClick={() => onListFiles(c.provider)}
            >
              {filesBusy && filesProvider === c.provider
                ? t("common.loading")
                : t("connector.recentPdfs")}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => onDisconnect(c.provider)}
            >
              {t("common.disconnect")}
            </button>
          </>
        )}
        {isPaid && !c.connected && statusLoaded && configured && (
          <a className="btn-primary" href={cloudConnectorConnectUrl(c.provider)}>
            {t("common.connect")}
          </a>
        )}
        {isPaid && !c.connected && statusLoaded && !configured && (
          <span className="btn-secondary cloud-connector-disabled" aria-disabled>
            {t("connector.connectUnavailable")}
          </span>
        )}
      </div>

      {isPaid && statusLoaded && !configured && (
          <div className="connector-secret-help">
            {c.provider === "onedrive" ? (
              <>
                <p>
                  <strong>OneDrive / Microsoft Entra</strong> — create the Entra app, then put the
                  client id/secret on the worker.
                </p>
                <ol className="connector-setup-steps">
                  <li>
                    Open{" "}
                    <a href="https://entra.microsoft.com/" target="_blank" rel="noopener noreferrer">
                      entra.microsoft.com
                    </a>{" "}
                    → <strong>App registrations</strong> → <strong>New registration</strong> (any org
                    + personal Microsoft accounts).
                  </li>
                  <li>
                    Redirect URI — platform <strong>Web</strong>:
                    <pre className="connector-pre">{ONEDRIVE_REDIRECT}</pre>
                  </li>
                  <li>
                    Graph delegated permissions: <code>User.Read</code>, <code>Files.Read</code>.
                  </li>
                  <li>
                    From <code>apps/worker</code>:
                    <pre className="connector-pre">{`wrangler secret put ONEDRIVE_CLIENT_ID
wrangler secret put ONEDRIVE_CLIENT_SECRET`}</pre>
                  </li>
                  <li>
                    Refresh this page, then <strong>Connect</strong>.
                  </li>
                </ol>
              </>
            ) : c.provider === "google" ? (
              <>
                <p>
                  <strong>Google (Drive + Gmail)</strong> — OAuth client in Google Cloud Console.
                  After connect, the Tool can save chase drafts into Gmail Drafts and read replies —
                  docstoc never sends.
                </p>
                <ol className="connector-setup-steps">
                  <li>
                    Open{" "}
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Google Cloud credentials
                    </a>{" "}
                    → create an <strong>OAuth 2.0 Client ID</strong> (Web application).
                  </li>
                  <li>
                    Authorized redirect URI:
                    <pre className="connector-pre">{CLOUD_REDIRECT_URIS.google}</pre>
                  </li>
                  <li>
                    Enable APIs: Drive, Gmail, Sheets, Calendar, People. Scopes include Drive
                    readonly, Gmail modify (drafts), Sheets, Calendar events, Contacts.
                  </li>
                  <li>
                    From <code>apps/worker</code>:
                    <pre className="connector-pre">{`wrangler secret put GOOGLE_INTEGRATIONS_CLIENT_ID
wrangler secret put GOOGLE_INTEGRATIONS_CLIENT_SECRET`}</pre>
                  </li>
                  <li>
                    Refresh this page, then <strong>Connect</strong> → approve Drive + Gmail →{" "}
                    <strong>Test</strong>.
                  </li>
                </ol>
              </>
            ) : (
              <>
                <p>
                  <strong>Set secrets</strong> for {CLOUD_LABELS[c.provider]} — not broken, just not
                  wired on this worker yet.
                </p>
                <ol>
                  <li>
                    Register redirect URI: <code>{CLOUD_REDIRECT_URIS[c.provider]}</code>
                  </li>
                  <li>
                    From <code>apps/worker</code>:
                    <pre className="connector-pre">{`wrangler secret put ${CLOUD_SECRET_NAMES[c.provider][0]}
wrangler secret put ${CLOUD_SECRET_NAMES[c.provider][1]}`}</pre>
                  </li>
                  <li>Redeploy the worker, refresh this page, then Connect → Test.</li>
                </ol>
              </>
            )}
          </div>
        )}
    </li>
  );
}
