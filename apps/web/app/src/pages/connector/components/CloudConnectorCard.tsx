import {
  CLOUD_REDIRECT_URIS,
  CLOUD_SECRET_NAMES,
  cloudConnectorConnectUrl,
  type CloudConnectorStatus,
  type CloudProvider,
} from "../../../lib/api";
import { CLOUD_LABELS } from "../../../lib/cloudImport";
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
  test: t,
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
  const configured = !statusLoaded || c.configured;
  const lastError =
    t.status === "fail"
      ? t.message
      : !configured
        ? "OAuth secrets not set on this worker yet."
        : null;

  return (
    <li className="cloud-connector-row connector-card">
      <div className="cloud-connector-meta">
        <strong>{CLOUD_LABELS[c.provider]}</strong>
        <div className="connector-checklist-marks">
          <StatusPill kind={configured ? "ok" : "warn"}>
            {configured ? "Configured" : "Secrets missing"}
          </StatusPill>
          <StatusPill kind={c.connected ? "ok" : "muted"}>
            {c.connected
              ? `Connected${c.externalEmail ? ` · ${c.externalEmail}` : ""}`
              : "Not connected"}
          </StatusPill>
          <StatusPill kind={t.status === "ok" ? "ok" : t.status === "fail" ? "fail" : "muted"}>
            {t.status === "ok"
              ? "Test OK"
              : t.status === "running"
                ? "Testing…"
                : t.status === "fail"
                  ? "Test fail"
                  : "Not tested"}
          </StatusPill>
        </div>
        {c.connected && c.connectedAt && (
          <span className="connector-key-detail">
            Since {new Date(c.connectedAt).toLocaleDateString()}
          </span>
        )}
        {lastError && (
          <p className="connector-last-error">
            Last error: {lastError}
            {t.hint ? ` — ${t.hint}` : ""}
          </p>
        )}
        {t.status === "ok" && t.message && (
          <p className="connector-test-ok-line">{t.message}</p>
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
              {testingProvider === c.provider ? "Testing…" : "Test"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={filesBusy}
              onClick={() => onListFiles(c.provider)}
            >
              {filesBusy && filesProvider === c.provider ? "Loading…" : "Recent PDFs"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => onDisconnect(c.provider)}
            >
              Disconnect
            </button>
          </>
        )}
        {isPaid && !c.connected && statusLoaded && configured && (
          <a className="btn-primary" href={cloudConnectorConnectUrl(c.provider)}>
            Connect
          </a>
        )}
        {isPaid && !c.connected && statusLoaded && !configured && (
          <span className="btn-secondary cloud-connector-disabled" aria-disabled>
            Connect unavailable
          </span>
        )}
      </div>

      {isPaid &&
        statusLoaded &&
        ((c.provider === "onedrive" && t.status !== "ok") ||
          (c.provider !== "onedrive" && !configured && t.status !== "ok")) && (
          <div className="connector-secret-help">
            {c.provider === "onedrive" ? (
              <>
                <p>
                  <strong>OneDrive / Microsoft Entra setup</strong> — stays open until Test OK. You
                  create the Entra app (we cannot do this for you), then put the client id/secret on
                  the worker.
                </p>
                {!configured ? (
                  <ol className="connector-setup-steps">
                    <li>
                      Open{" "}
                      <a href="https://entra.microsoft.com/" target="_blank" rel="noopener noreferrer">
                        entra.microsoft.com
                      </a>{" "}
                      → <strong>Identity</strong> → <strong>Applications</strong> →{" "}
                      <strong>App registrations</strong> → <strong>New registration</strong>.
                    </li>
                    <li>
                      Name: <code>Chasa OneDrive</code> (any name is fine). Supported account types:{" "}
                      <em>
                        Accounts in any organizational directory and personal Microsoft accounts
                      </em>
                      .
                    </li>
                    <li>
                      Redirect URI — platform <strong>Web</strong>, exact value:
                      <pre className="connector-pre">{ONEDRIVE_REDIRECT}</pre>
                    </li>
                    <li>
                      Click <strong>Register</strong>. On Overview, copy{" "}
                      <strong>Application (client) ID</strong>.
                    </li>
                    <li>
                      <strong>Certificates &amp; secrets</strong> → <strong>New client secret</strong>{" "}
                      → copy the <strong>Value</strong> immediately (shown once).
                    </li>
                    <li>
                      <strong>API permissions</strong> → <strong>Add a permission</strong> →{" "}
                      <strong>Microsoft Graph</strong> → <strong>Delegated</strong> → add{" "}
                      <code>User.Read</code> and <code>Files.Read</code>. <code>offline_access</code>{" "}
                      is requested at connect time (no admin consent needed for personal/delegated).
                    </li>
                    <li>
                      From <code>apps/worker</code>, set secrets (paste when prompted — do not invent
                      values):
                      <pre className="connector-pre">{`wrangler secret put ONEDRIVE_CLIENT_ID
wrangler secret put ONEDRIVE_CLIENT_SECRET`}</pre>
                    </li>
                    <li>
                      Redeploy the worker, refresh this page, then <strong>Connect</strong> → approve
                      → <strong>Test</strong>.
                    </li>
                  </ol>
                ) : !c.connected ? (
                  <ol className="connector-setup-steps">
                    <li>
                      Secrets are set. Redirect URI must still be exactly:
                      <pre className="connector-pre">{ONEDRIVE_REDIRECT}</pre>
                    </li>
                    <li>
                      Click <strong>Connect</strong>, sign in with Microsoft, and approve{" "}
                      <code>User.Read</code>, <code>Files.Read</code>, and <code>offline_access</code>
                      .
                    </li>
                    <li>
                      Back here, click <strong>Test</strong> — this panel collapses only after Test
                      OK.
                    </li>
                  </ol>
                ) : (
                  <p>
                    Connected — click <strong>Test</strong> to verify OneDrive file access. This panel
                    stays open until Test OK.
                  </p>
                )}
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
