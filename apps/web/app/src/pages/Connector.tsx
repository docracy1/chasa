import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  CLOUD_IMPORT_STORAGE_KEY,
  cloudConnectorConnectUrl,
  createConnectorKey,
  disconnectCloudConnector,
  importCloudConnectorFile,
  listCloudConnectorFiles,
  listCloudConnectors,
  listConnectorKeys,
  revokeConnectorKey,
  type Account,
  type CloudConnectorStatus,
  type CloudFile,
  type CloudProvider,
  type ConnectorKey,
} from "../lib/api";

const DRAFT_URL = "https://api.chasa.io/api/v1/chase/draft";

const CLOUD_LABELS: Record<CloudProvider, string> = {
  dropbox: "Dropbox",
  onedrive: "OneDrive",
  box: "Box",
};

export default function ConnectorPage({ account }: { account: Account | null }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [keys, setKeys] = useState<ConnectorKey[]>([]);
  const [cloud, setCloud] = useState<CloudConnectorStatus[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cloudMsg, setCloudMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [filesProvider, setFilesProvider] = useState<CloudProvider | null>(null);
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [filesBusy, setFilesBusy] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);

  const isPaid = !!account && account.plan !== "free";

  async function refresh() {
    if (!account || !isPaid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [keysRes, cloudRes] = await Promise.all([listConnectorKeys(), listCloudConnectors()]);
      setKeys(keysRes.keys);
      setCloud(cloudRes.connectors);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load connectors");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.email, isPaid]);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const cloudProvider = searchParams.get("cloud");
    const cloudError = searchParams.get("error");
    if (connected === "1" && cloudProvider) {
      setCloudMsg(`Connected ${CLOUD_LABELS[cloudProvider as CloudProvider] ?? cloudProvider}.`);
      setSearchParams({}, { replace: true });
      if (isPaid) refresh();
    } else if (cloudError && cloudProvider) {
      setError(`Could not connect ${CLOUD_LABELS[cloudProvider as CloudProvider] ?? cloudProvider}.`);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!account) {
    return (
      <div className="panel">
        <h1>Connector</h1>
        <p className="page-sub">
          Sign in to connect Dropbox, OneDrive, or Box, or create API keys for Zapier / Make
          (QuickBooks, FreshBooks, Xero, Wave, Zoho, sevDesk, and more). CSV upload works without a
          paid plan in the Tool.
        </p>
        <a className="btn-primary" href="/app/login">
          Sign in
        </a>
      </div>
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!isPaid) return;
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const created = await createConnectorKey(name.trim() || undefined);
      setNewToken(created.token);
      setName("");
      setAdding(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create key");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!isPaid) return;
    setBusy(true);
    setError(null);
    try {
      await revokeConnectorKey(id);
      if (newToken) setNewToken(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revoke key");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect(provider: CloudProvider) {
    if (!isPaid) return;
    setBusy(true);
    setError(null);
    setCloudMsg(null);
    try {
      await disconnectCloudConnector(provider);
      if (filesProvider === provider) {
        setFilesProvider(null);
        setFiles([]);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect");
    } finally {
      setBusy(false);
    }
  }

  async function handleListFiles(provider: CloudProvider) {
    if (!isPaid) return;
    setFilesBusy(true);
    setError(null);
    setFilesProvider(provider);
    try {
      const res = await listCloudConnectorFiles(provider);
      setFiles(res.files);
    } catch (err) {
      setFiles([]);
      setError(err instanceof Error ? err.message : "Could not list files");
    } finally {
      setFilesBusy(false);
    }
  }

  async function handleImportFile(provider: CloudProvider, file: CloudFile) {
    if (!isPaid) return;
    setImportingId(file.id);
    setError(null);
    try {
      const result = await importCloudConnectorFile(provider, {
        id: file.id,
        path: file.path,
      });
      sessionStorage.setItem(
        CLOUD_IMPORT_STORAGE_KEY,
        JSON.stringify({
          provider,
          providerLabel: CLOUD_LABELS[provider],
          ...result,
        })
      );
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import PDF");
    } finally {
      setImportingId(null);
    }
  }

  async function copyToken() {
    if (!newToken) return;
    await navigator.clipboard.writeText(newToken);
    setCopied(true);
  }

  const anyConfigured = cloud.some((c) => c.configured);

  return (
    <div className="webhooks-page">
      <p className="crumb">
        <Link to="/account">Account</Link> / Connector
      </p>

      <section className="branding-card">
        <h1 className="webhooks-title">Cloud storage</h1>
        <p className="branding-help">
          Connect Dropbox, OneDrive, or Box, then import an invoice PDF into the Tool. Chasa
          downloads the file with your stored tokens, scrapes text for client / amount / due date
          hints, and never emails your client — you always review drafts yourself.
        </p>

        {!isPaid && (
          <div className="upgrade-nudge">
            Cloud storage is on Solo ($7), Pro ($17), and Enterprise — not Enterprise-only.{" "}
            <Link to="/account">Upgrade</Link> to connect Dropbox, OneDrive, or Box.
          </div>
        )}

        {isPaid && !loading && !anyConfigured && (
          <div className="upgrade-nudge">
            Cloud OAuth apps are not configured on this server yet. An operator must register
            redirect URIs and set secrets (see README —{" "}
            <code>wrangler secret put DROPBOX_CLIENT_ID</code>, etc.). Connect buttons stay disabled
            until those are set.
          </div>
        )}

        {cloudMsg && <div className="connector-ok-msg">{cloudMsg}</div>}
        {error && <div className="error-msg">{error}</div>}

        {loading && isPaid ? (
          <p className="page-sub">Loading…</p>
        ) : (
          <ul className="cloud-connector-list">
            {(cloud.length
              ? cloud
              : (["dropbox", "onedrive", "box"] as CloudProvider[]).map((provider) => ({
                  provider,
                  connected: false,
                  externalEmail: null,
                  externalUserId: null,
                  connectedAt: null,
                  configured: false,
                }))
            ).map((c) => (
              <li key={c.provider} className="cloud-connector-row">
                <div className="cloud-connector-meta">
                  <strong>{CLOUD_LABELS[c.provider]}</strong>
                  {c.connected ? (
                    <span className="connector-key-detail">
                      Connected
                      {c.externalEmail ? ` as ${c.externalEmail}` : ""}
                      {c.connectedAt
                        ? ` · ${new Date(c.connectedAt).toLocaleDateString()}`
                        : ""}
                    </span>
                  ) : (
                    <span className="connector-key-detail">
                      {isPaid && !c.configured
                        ? "Not configured on this server yet"
                        : "Not connected"}
                    </span>
                  )}
                </div>
                <div className="cloud-connector-actions">
                  {isPaid && c.connected && (
                    <>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={filesBusy}
                        onClick={() => handleListFiles(c.provider)}
                      >
                        {filesBusy && filesProvider === c.provider
                          ? "Loading…"
                          : "Recent PDFs"}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={busy}
                        onClick={() => handleDisconnect(c.provider)}
                      >
                        Disconnect
                      </button>
                    </>
                  )}
                  {isPaid && !c.connected && c.configured && (
                    <a className="btn-primary" href={cloudConnectorConnectUrl(c.provider)}>
                      Connect
                    </a>
                  )}
                  {isPaid && !c.connected && !c.configured && (
                    <span className="btn-secondary cloud-connector-disabled" aria-disabled>
                      Connect
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {filesProvider && (
          <div className="cloud-files">
            <h2>Recent PDFs — {CLOUD_LABELS[filesProvider]}</h2>
            {files.length === 0 && !filesBusy ? (
              <p className="branding-help">No PDF files found in the usual locations.</p>
            ) : (
              <ul className="cloud-files-list">
                {files.map((f) => (
                  <li key={f.id}>
                    <div className="cloud-file-meta">
                      <code>{f.name}</code>
                      {f.modifiedAt && (
                        <span className="connector-key-detail">
                          {new Date(f.modifiedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={importingId !== null}
                      onClick={() => handleImportFile(filesProvider, f)}
                    >
                      {importingId === f.id ? "Importing…" : "Import to Tool"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="branding-help" style={{ marginTop: 10 }}>
              Import downloads the PDF through Chasa (encrypted tokens, paid only), extracts text
              hints, and opens the Tool so you can confirm client / amount / due date before
              drafting.
            </p>
          </div>
        )}
      </section>

      <section className="branding-card" style={{ marginTop: 20 }}>
        <h1 className="webhooks-title">Accounting integrations</h1>
        <p className="branding-help">
          Chasa does <strong>not</strong> offer native QuickBooks, FreshBooks, Xero, Wave, Zoho, or
          sevDesk OAuth. Use Zapier or Make with an API key (Solo+), or export a CSV and upload it in
          the Tool (all plans). Draft only — Chasa never emails your client.
        </p>

        {!isPaid && (
          <div className="upgrade-nudge">
            Zapier / Make API keys are on Solo ($7), Pro ($17), and Enterprise.{" "}
            <Link to="/account">Upgrade</Link> to automate drafts from your accounting app. CSV
            upload works on Free.
          </div>
        )}

        {newToken && (
          <div className="connector-token-once">
            <p>
              <strong>Copy your API key now</strong> — it won’t be shown again.
            </p>
            <code className="connector-token">{newToken}</code>
            <div className="connector-token-actions">
              <button type="button" className="btn-primary" onClick={copyToken}>
                {copied ? "Copied" : "Copy key"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setNewToken(null)}>
                Done
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="page-sub">Loading…</p>
        ) : keys.length === 0 ? (
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
                    onClick={() => handleRevoke(k.id)}
                  >
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {isPaid && !adding && (
          <button type="button" className="btn-primary" onClick={() => setAdding(true)}>
            + Create API key
          </button>
        )}

        {isPaid && adding && (
          <form className="webhooks-add" onSubmit={handleCreate}>
            <input
              type="text"
              placeholder="Name (optional) — e.g. Zapier"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
            />
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "Creating…" : "Create"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => {
                setAdding(false);
                setName("");
              }}
            >
              Cancel
            </button>
          </form>
        )}

        <div className="webhooks-events">
          <h2>How to use Zapier or Make</h2>
          <ol className="branding-help" style={{ paddingLeft: 20, margin: "8px 0 12px" }}>
            <li>Create an API key above (Solo+).</li>
            <li>
              In Zapier/Make: trigger when an invoice is overdue in QuickBooks Online, FreshBooks,
              Xero, Wave, Zoho, sevDesk, or another app.
            </li>
            <li>
              Action: Webhooks / HTTP — <code>POST</code> to the URL below with{" "}
              <code>Authorization: Bearer chasa_…</code>
            </li>
            <li>Review the draft Chasa returns, then send it from your own inbox.</li>
          </ol>
          <p className="connector-endpoint">
            <code>POST {DRAFT_URL}</code>
          </p>
          <p className="branding-help">JSON body (either shape works):</p>
          <pre className="connector-pre">{`{
  "client_name": "Acme LLC",
  "invoice_amount": 1250,
  "days_overdue": 14
}`}</pre>
          <pre className="connector-pre">{`{
  "customer": "Acme LLC",
  "amount": 1250,
  "due_date": "2026-07-01"
}`}</pre>
          <p className="branding-help">
            Response includes <code>subject</code>, <code>body</code>, and{" "}
            <code>tone_band</code>. Draft only — send from your own inbox.
          </p>
        </div>

        <div className="webhooks-events">
          <h2>Accounting CSV (QBO, FreshBooks, Xero, Wave, Zoho, sevDesk)</h2>
          <ol className="branding-help" style={{ paddingLeft: 20, margin: "8px 0 12px" }}>
            <li>In your accounting app, export open / overdue invoices as CSV.</li>
            <li>
              In the <Link to="/">Tool</Link>, use Upload CSV (available on Free).
            </li>
            <li>
              Common headers (Customer / Kunde, Amount Due / Balance / Betrag, Due Date /
              Fälligkeitsdatum, Days Overdue) are mapped automatically — then generate drafts as
              usual.
            </li>
          </ol>
          <p className="branding-help" style={{ marginTop: 12 }}>
            Chasa never emails the client — you always review and send the draft yourself.
          </p>
        </div>
      </section>
    </div>
  );
}
