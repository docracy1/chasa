import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  CLOUD_IMPORT_STORAGE_KEY,
  CLOUD_REDIRECT_URIS,
  CLOUD_SECRET_NAMES,
  cloudConnectorConnectUrl,
  createConnectorKey,
  disconnectCloudConnector,
  explainCloudConnectorError,
  importCloudConnectorFile,
  listCloudConnectorFiles,
  listCloudConnectors,
  listConnectorKeys,
  revokeConnectorKey,
  testCloudConnector,
  type Account,
  type CloudConnectorStatus,
  type CloudConnectorTestResult,
  type CloudFile,
  type CloudProvider,
  type ConnectorKey,
} from "../lib/api";

const DRAFT_URL = "https://api.chasa.io/api/v1/chase/draft";
const PROVIDERS: CloudProvider[] = ["dropbox", "onedrive", "box"];
const TEST_OK_STORAGE_KEY = "chasa.connectorTestOk";

const CLOUD_LABELS: Record<CloudProvider, string> = {
  dropbox: "Dropbox",
  onedrive: "OneDrive",
  box: "Box",
};

type ProviderTestState = {
  status: "idle" | "running" | "ok" | "fail";
  message: string | null;
  hint: string | null;
  at: string | null;
};

function emptyTests(): Record<CloudProvider, ProviderTestState> {
  return {
    dropbox: { status: "idle", message: null, hint: null, at: null },
    onedrive: { status: "idle", message: null, hint: null, at: null },
    box: { status: "idle", message: null, hint: null, at: null },
  };
}

function loadPersistedTests(): Record<CloudProvider, ProviderTestState> {
  try {
    const raw = localStorage.getItem(TEST_OK_STORAGE_KEY);
    if (!raw) return emptyTests();
    const parsed = JSON.parse(raw) as Partial<Record<CloudProvider, ProviderTestState>>;
    const next = emptyTests();
    for (const p of PROVIDERS) {
      if (parsed[p]?.status === "ok") {
        next[p] = {
          status: "ok",
          message: parsed[p]?.message ?? "OK (restored)",
          hint: null,
          at: parsed[p]?.at ?? null,
        };
      }
    }
    return next;
  } catch {
    return emptyTests();
  }
}

function persistTests(tests: Record<CloudProvider, ProviderTestState>) {
  const toSave: Partial<Record<CloudProvider, ProviderTestState>> = {};
  for (const p of PROVIDERS) {
    if (tests[p].status === "ok") toSave[p] = tests[p];
  }
  if (Object.keys(toSave).length === 0) {
    localStorage.removeItem(TEST_OK_STORAGE_KEY);
  } else {
    localStorage.setItem(TEST_OK_STORAGE_KEY, JSON.stringify(toSave));
  }
}

function sampleCurl(token: string): string {
  return `curl -sS -X POST '${DRAFT_URL}' \\
  -H 'Authorization: Bearer ${token}' \\
  -H 'Content-Type: application/json' \\
  -d '{"client_name":"Acme LLC","invoice_amount":1250,"days_overdue":14}'`;
}

function StatusPill({
  kind,
  children,
}: {
  kind: "ok" | "warn" | "muted" | "fail";
  children: ReactNode;
}) {
  return <span className={`connector-pill connector-pill-${kind}`}>{children}</span>;
}

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
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [filesProvider, setFilesProvider] = useState<CloudProvider | null>(null);
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [filesBusy, setFilesBusy] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<CloudProvider, ProviderTestState>>(loadPersistedTests);
  const [testingProvider, setTestingProvider] = useState<CloudProvider | null>(null);
  const [notesCollapsed, setNotesCollapsed] = useState(false);
  const [apiKeyTested, setApiKeyTested] = useState(() => {
    try {
      return localStorage.getItem("chasa.apiKeyTestOk") === "1";
    } catch {
      return false;
    }
  });

  const isPaid = !!account && account.plan !== "free";
  const isAdmin = account?.email?.toLowerCase() === "rl@relacon.at";

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
    const connectedParam = searchParams.get("connected");
    const cloudProvider =
      searchParams.get("cloud") ||
      (connectedParam && PROVIDERS.includes(connectedParam as CloudProvider)
        ? connectedParam
        : null);
    const cloudError = searchParams.get("error");
    const errorDesc = searchParams.get("error_description");

    if (cloudError) {
      const label = CLOUD_LABELS[(cloudProvider as CloudProvider) ?? "dropbox"] ?? cloudProvider ?? "provider";
      const explained = explainCloudConnectorError(cloudError, errorDesc);
      setError(`${label}: ${explained}`);
      if (cloudProvider && PROVIDERS.includes(cloudProvider as CloudProvider)) {
        const p = cloudProvider as CloudProvider;
        setTests((prev) => {
          const next = {
            ...prev,
            [p]: {
              status: "fail" as const,
              message: explained,
              hint: null,
              at: new Date().toISOString(),
            },
          };
          persistTests(next);
          return next;
        });
      }
      setSearchParams({}, { replace: true });
      return;
    }

    if (
      connectedParam &&
      (connectedParam === "1" || PROVIDERS.includes(connectedParam as CloudProvider))
    ) {
      const provider =
        (PROVIDERS.includes(connectedParam as CloudProvider)
          ? connectedParam
          : cloudProvider) as CloudProvider | null;
      const label = provider ? CLOUD_LABELS[provider] : "cloud storage";
      setCloudMsg(`Connected ${label}. Run Test to verify file access.`);
      setSearchParams({}, { replace: true });
      if (isPaid) refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusByProvider = useMemo(() => {
    const map = new Map<CloudProvider, CloudConnectorStatus>();
    for (const c of cloud) map.set(c.provider, c);
    return map;
  }, [cloud]);

  const allCloudTestOk = PROVIDERS.every((p) => tests[p].status === "ok");
  const checklistDone = allCloudTestOk && (apiKeyTested || keys.length > 0);
  // Keep checklist + operator notes fully open until cloud tests pass.
  const keepSetupOpen = !allCloudTestOk;

  useEffect(() => {
    if (keepSetupOpen) setNotesCollapsed(false);
  }, [keepSetupOpen]);

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
    setCopiedCurl(false);
    try {
      const created = await createConnectorKey(name.trim() || "Test key");
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

  async function handleCreateTestKey() {
    if (!isPaid) return;
    setBusy(true);
    setError(null);
    setCopied(false);
    setCopiedCurl(false);
    try {
      const created = await createConnectorKey("Zapier test");
      setNewToken(created.token);
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
      setTests((prev) => {
        const next = {
          ...prev,
          [provider]: { status: "idle" as const, message: null, hint: null, at: null },
        };
        persistTests(next);
        return next;
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect");
    } finally {
      setBusy(false);
    }
  }

  async function handleTest(provider: CloudProvider) {
    if (!isPaid) return;
    setTestingProvider(provider);
    setError(null);
    setTests((prev) => ({
      ...prev,
      [provider]: { ...prev[provider], status: "running", message: "Testing…", hint: null },
    }));
    try {
      const result: CloudConnectorTestResult = await testCloudConnector(provider);
      setTests((prev) => {
        const next = {
          ...prev,
          [provider]: {
            status: result.ok ? ("ok" as const) : ("fail" as const),
            message: result.message,
            hint: result.hint || result.explanation || null,
            at: new Date().toISOString(),
          },
        };
        persistTests(next);
        return next;
      });
      if (result.ok) {
        setCloudMsg(`${CLOUD_LABELS[provider]} test OK.`);
        const listed = await listCloudConnectorFiles(provider).catch(() => null);
        if (listed) {
          setFilesProvider(provider);
          setFiles(listed.files);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Test failed";
      setTests((prev) => {
        const next = {
          ...prev,
          [provider]: {
            status: "fail" as const,
            message: msg,
            hint: null,
            at: new Date().toISOString(),
          },
        };
        persistTests(next);
        return next;
      });
    } finally {
      setTestingProvider(null);
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

  async function copyCurl() {
    if (!newToken) return;
    await navigator.clipboard.writeText(sampleCurl(newToken));
    setCopiedCurl(true);
    setApiKeyTested(true);
    try {
      localStorage.setItem("chasa.apiKeyTestOk", "1");
    } catch {
      /* ignore */
    }
  }

  const statusLoaded = cloud.length > 0;
  const placeholderCloud: CloudConnectorStatus[] = PROVIDERS.map((provider) => ({
    provider,
    connected: false,
    externalEmail: null,
    externalUserId: null,
    connectedAt: null,
    configured: true,
  }));
  const rows = statusLoaded ? cloud : placeholderCloud;
  const missingSecrets = rows.filter((c) => statusLoaded && !c.configured);

  return (
    <div className="webhooks-page connector-test-page">
      <p className="crumb">
        <Link to="/account">Account</Link> / Connector
        {isAdmin ? <span className="connector-admin-tag"> · Test connectors</span> : null}
      </p>

      <section className="branding-card connector-test-hero">
        <h1 className="webhooks-title">Connector test dashboard</h1>
        <p className="branding-help">
          Verify Dropbox, OneDrive, Box, and a Zapier API key here — Connect, Test, then import a
          PDF when green. Done when all three cloud providers show Connected + Test OK.
        </p>

        {!isPaid && (
          <div className="upgrade-nudge">
            Cloud storage and API keys are on Solo ($7), Pro ($17), and Enterprise.{" "}
            <Link to="/account">Upgrade</Link> to run this checklist.
          </div>
        )}

        {cloudMsg && <div className="connector-ok-msg">{cloudMsg}</div>}
        {error && <div className="error-msg">{error}</div>}

        {/* Checklist — always expanded until cloud tests pass */}
        {(keepSetupOpen || !notesCollapsed) && (
          <div className="connector-checklist">
            <h2>Checklist</h2>
            <p className="branding-help" style={{ marginTop: 0 }}>
              Done when all three show Connected + Test OK
              {checklistDone ? " — you’re there." : "."}
            </p>
            <ul className="connector-checklist-list">
              {PROVIDERS.map((p) => {
                const st = statusByProvider.get(p);
                const t = tests[p];
                const configured = !statusLoaded || st?.configured !== false;
                const connected = !!st?.connected;
                const testOk = t.status === "ok";
                return (
                  <li key={p}>
                    <strong>{CLOUD_LABELS[p]}</strong>
                    <span className="connector-checklist-marks">
                      <StatusPill kind={configured ? "ok" : "warn"}>
                        {configured ? "Configured" : "Secrets missing"}
                      </StatusPill>
                      <StatusPill kind={connected ? "ok" : "muted"}>
                        {connected ? "Connected" : "Not connected"}
                      </StatusPill>
                      <StatusPill kind={testOk ? "ok" : t.status === "fail" ? "fail" : "muted"}>
                        {testOk ? "Test OK" : t.status === "fail" ? "Test fail" : "Test pending"}
                      </StatusPill>
                    </span>
                  </li>
                );
              })}
              <li>
                <strong>Zapier / API key</strong>
                <span className="connector-checklist-marks">
                  <StatusPill kind={keys.length > 0 || newToken ? "ok" : "muted"}>
                    {keys.length > 0 || newToken ? "Key created" : "No key yet"}
                  </StatusPill>
                  <StatusPill kind={apiKeyTested ? "ok" : "muted"}>
                    {apiKeyTested ? "Curl copied" : "Copy curl to verify"}
                  </StatusPill>
                </span>
              </li>
            </ul>
          </div>
        )}

        {allCloudTestOk && notesCollapsed && (
          <div className="connector-checklist connector-checklist-compact">
            <p>
              All three cloud connectors tested OK.
              <button
                type="button"
                className="btn-secondary"
                style={{ marginLeft: 12 }}
                onClick={() => setNotesCollapsed(false)}
              >
                Show checklist
              </button>
            </p>
          </div>
        )}

        {allCloudTestOk && !notesCollapsed && (
          <p className="branding-help">
            <button type="button" className="btn-secondary" onClick={() => setNotesCollapsed(true)}>
              Collapse checklist
            </button>
          </p>
        )}
      </section>

      <section className="branding-card" style={{ marginTop: 20 }}>
        <h2 className="webhooks-title" style={{ fontSize: "1.25rem" }}>
          Cloud storage
        </h2>
        <p className="branding-help">
          Connect Dropbox, OneDrive, or Box, run Test, then import an invoice PDF into the Tool.
          Chasa never emails your client.
        </p>

        {loading && isPaid ? (
          <p className="page-sub">Loading…</p>
        ) : (
          <ul className="cloud-connector-list connector-cards">
            {rows.map((c) => {
              const t = tests[c.provider];
              const configured = !statusLoaded || c.configured;
              const lastError =
                t.status === "fail"
                  ? t.message
                  : !configured
                    ? "OAuth secrets not set on this worker yet."
                    : null;

              return (
                <li key={c.provider} className="cloud-connector-row connector-card">
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
                      <StatusPill
                        kind={
                          t.status === "ok" ? "ok" : t.status === "fail" ? "fail" : "muted"
                        }
                      >
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
                          onClick={() => handleTest(c.provider)}
                        >
                          {testingProvider === c.provider ? "Testing…" : "Test"}
                        </button>
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

                  {/* Secret instructions — always visible (not collapsed) while that provider isn't tested OK */}
                  {isPaid && statusLoaded && !configured && t.status !== "ok" && (
                    <div className="connector-secret-help">
                      <p>
                        <strong>Set secrets</strong> for {CLOUD_LABELS[c.provider]} — not broken,
                        just not wired on this worker yet.
                      </p>
                      <ol>
                        <li>
                          Register redirect URI:{" "}
                          <code>{CLOUD_REDIRECT_URIS[c.provider]}</code>
                        </li>
                        <li>
                          From <code>apps/worker</code>:
                          <pre className="connector-pre">{`wrangler secret put ${CLOUD_SECRET_NAMES[c.provider][0]}
wrangler secret put ${CLOUD_SECRET_NAMES[c.provider][1]}`}</pre>
                        </li>
                        <li>Redeploy the worker, refresh this page, then Connect → Test.</li>
                      </ol>
                    </div>
                  )}
                </li>
              );
            })}
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
          </div>
        )}
      </section>

      {/* Operator notes — always expanded until all cloud tests pass; no <details> while incomplete */}
      {isPaid && (keepSetupOpen || !notesCollapsed) && (
        <section className="branding-card connector-operator-notes" style={{ marginTop: 20 }}>
          <h2 className="webhooks-title" style={{ fontSize: "1.25rem" }}>
            Operator notes
          </h2>
          <p className="branding-help">
            Exact redirect URIs (register in each provider console) and which secrets are still
            missing.
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
            </tbody>
          </table>
          {missingSecrets.length > 0 && (
            <div className="connector-secret-help" style={{ marginTop: 14 }}>
              <p>
                <strong>Still missing</strong> ({missingSecrets.map((s) => CLOUD_LABELS[s.provider]).join(", ")}
                ):
              </p>
              <pre className="connector-pre">
                {missingSecrets
                  .flatMap((s) =>
                    CLOUD_SECRET_NAMES[s.provider].map((n) => `wrangler secret put ${n}`)
                  )
                  .join("\n")}
              </pre>
            </div>
          )}
          {missingSecrets.length === 0 && statusLoaded && (
            <p className="branding-help">All three OAuth secret pairs look configured on this worker.</p>
          )}
          {!keepSetupOpen && (
            <button
              type="button"
              className="btn-secondary"
              style={{ marginTop: 12 }}
              onClick={() => setNotesCollapsed(true)}
            >
              Collapse operator notes
            </button>
          )}
        </section>
      )}

      {isPaid && allCloudTestOk && notesCollapsed && (
        <section className="branding-card" style={{ marginTop: 20 }}>
          <p className="branding-help" style={{ margin: 0 }}>
            Operator notes collapsed (all tests passed).{" "}
            <button type="button" className="btn-secondary" onClick={() => setNotesCollapsed(false)}>
              Show again
            </button>
          </p>
        </section>
      )}

      <section className="branding-card" style={{ marginTop: 20 }}>
        <h1 className="webhooks-title" style={{ fontSize: "1.25rem" }}>
          Zapier / API key
        </h1>
        <p className="branding-help">
          Create a test key and copy a curl one-liner for{" "}
          <code>POST /api/v1/chase/draft</code>. Draft only — Chasa never emails your client.
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
              onClick={() => handleCreateTestKey()}
            >
              {busy ? "Creating…" : "Create test key"}
            </button>
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
                {copied ? "Copied key" : "Copy key"}
              </button>
              <button type="button" className="btn-primary" onClick={copyCurl}>
                {copiedCurl ? "Copied curl" : "Copy curl one-liner"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setNewToken(null)}>
                Done
              </button>
            </div>
            <p className="branding-help" style={{ marginTop: 12 }}>
              Sample request:
            </p>
            <pre className="connector-pre">{sampleCurl(newToken)}</pre>
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
                    onClick={() => handleRevoke(k.id)}
                  >
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {isPaid && !adding && !newToken && (
          <button type="button" className="btn-secondary" onClick={() => setAdding(true)}>
            + Create named API key
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
    </div>
  );
}
