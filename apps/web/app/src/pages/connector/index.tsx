import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useT } from "../../lib/i18n";
import {
  CLOUD_IMPORT_STORAGE_KEY,
  createConnectorKey,
  disconnectAccountingConnector,
  disconnectCloudConnector,
  explainCloudConnectorError,
  importAccountingInvoices,
  importCloudConnectorFile,
  listCloudConnectorFiles,
  listCloudConnectors,
  listConnectorKeys,
  revokeConnectorKey,
  testCloudConnector,
  type Account,
  type AccountingConnectorStatus,
  type AccountingProvider,
  type CloudConnectorStatus,
  type CloudConnectorTestResult,
  type CloudFile,
  type CloudProvider,
  type ConnectorKey,
} from "../../lib/api";
import { CLOUD_LABELS } from "../../lib/cloudImport";
import { AccountingSection } from "./components/AccountingSection";
import { ApiKeySection } from "./components/ApiKeySection";
import { CloudStorageSection } from "./components/CloudStorageSection";
import { ConnectorHero } from "./components/ConnectorHero";
import { OperatorNotesSection } from "./components/OperatorNotesSection";
import { SignInPanel } from "./components/SignInPanel";
import {
  ACCOUNTING_LABELS,
  ACCOUNTING_PROVIDERS,
  API_KEY_TEST_OK_STORAGE_KEY,
  PROVIDERS,
} from "./constants";
import type { ProviderTests } from "./types";
import { loadPersistedTests, persistTests, sampleCurl } from "./utils";

export default function ConnectorPage({ account }: { account: Account | null }) {
  const t = useT();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [keys, setKeys] = useState<ConnectorKey[]>([]);
  const [cloud, setCloud] = useState<CloudConnectorStatus[]>([]);
  const [accounting, setAccounting] = useState<AccountingConnectorStatus[]>([]);
  const [accountingBusy, setAccountingBusy] = useState<AccountingProvider | null>(null);
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
  const [tests, setTests] = useState<ProviderTests>(loadPersistedTests);
  const [testingProvider, setTestingProvider] = useState<CloudProvider | null>(null);
  const [notesCollapsed, setNotesCollapsed] = useState(false);
  const [apiKeyTested, setApiKeyTested] = useState(() => {
    try {
      return localStorage.getItem(API_KEY_TEST_OK_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  const isPaid = !!account && account.plan !== "free";
  const isOperator = account?.role === "admin" && account?.plan === "enterprise";

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
      setAccounting(cloudRes.accounting ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("connector.loadFailed"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
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
      const label =
        CLOUD_LABELS[(cloudProvider as CloudProvider) ?? "dropbox"] ?? cloudProvider ?? "provider";
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
      (connectedParam === "1" ||
        PROVIDERS.includes(connectedParam as CloudProvider) ||
        ACCOUNTING_PROVIDERS.includes(connectedParam as AccountingProvider))
    ) {
      const isAccounting = ACCOUNTING_PROVIDERS.includes(connectedParam as AccountingProvider);
      const label = isAccounting
        ? ACCOUNTING_LABELS[connectedParam as AccountingProvider]
        : PROVIDERS.includes(connectedParam as CloudProvider)
          ? CLOUD_LABELS[connectedParam as CloudProvider]
          : "provider";
      setCloudMsg(
        isAccounting
          ? t("connector.connectedAccounting", { label })
          : t("connector.connectedCloud", { label })
      );
      setSearchParams({}, { replace: true });
      if (isPaid) refresh();
    }
  }, []);

  const statusByProvider = useMemo(() => {
    const map = new Map<CloudProvider, CloudConnectorStatus>();
    for (const c of cloud) map.set(c.provider, c);
    return map;
  }, [cloud]);

  const allCloudTestOk = PROVIDERS.every((p) => tests[p].status === "ok");
  const checklistDone = allCloudTestOk && (apiKeyTested || keys.length > 0);
  const keepSetupOpen = !allCloudTestOk;

  useEffect(() => {
    if (keepSetupOpen) setNotesCollapsed(false);
  }, [keepSetupOpen]);

  if (!account) {
    return <SignInPanel />;
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
      setError(err instanceof Error ? err.message : t("connector.createKeyFailed"));
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
      setError(err instanceof Error ? err.message : t("connector.createKeyFailed"));
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
      setError(err instanceof Error ? err.message : t("connector.revokeFailed"));
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
      setError(err instanceof Error ? err.message : t("connector.disconnectFailed"));
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
      [provider]: { ...prev[provider], status: "running", message: t("common.testing"), hint: null },
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
        setCloudMsg(t("connector.testOkMsg", { label: CLOUD_LABELS[provider] }));
        const listed = await listCloudConnectorFiles(provider).catch(() => null);
        if (listed) {
          setFilesProvider(provider);
          setFiles(listed.files);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("connector.testFailed");
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
      setError(err instanceof Error ? err.message : t("connector.listFilesFailed"));
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
      setError(err instanceof Error ? err.message : t("connector.importPdfFailed"));
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
      localStorage.setItem(API_KEY_TEST_OK_STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  async function handleAccountingImport(provider: AccountingProvider) {
    setAccountingBusy(provider);
    setError(null);
    try {
      const res = await importAccountingInvoices(provider);
      setCloudMsg(
        t("connector.importedAccounting", {
          count: res.imported,
          suffix: res.imported === 1 ? "" : "s",
          provider: ACCOUNTING_LABELS[provider],
        })
      );
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("connector.importFailed"));
    } finally {
      setAccountingBusy(null);
    }
  }

  async function handleAccountingDisconnect(provider: AccountingProvider) {
    try {
      await disconnectAccountingConnector(provider);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("connector.disconnectFailed"));
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
        <Link to="/account">{t("team.crumbAccount")}</Link> / {t("connector.signInTitle")}
        {isOperator ? <span className="connector-admin-tag">{t("connector.enterpriseAdmin")}</span> : null}
      </p>

      <ConnectorHero
        isPaid={isPaid}
        cloudMsg={cloudMsg}
        error={error}
        keepSetupOpen={keepSetupOpen}
        notesCollapsed={notesCollapsed}
        allCloudTestOk={allCloudTestOk}
        checklistDone={checklistDone}
        tests={tests}
        statusByProvider={statusByProvider}
        statusLoaded={statusLoaded}
        keysCount={keys.length}
        hasNewToken={!!newToken}
        apiKeyTested={apiKeyTested}
        onExpandChecklist={() => setNotesCollapsed(false)}
        onCollapseChecklist={() => setNotesCollapsed(true)}
      />

      <CloudStorageSection
        loading={loading}
        isPaid={isPaid}
        rows={rows}
        statusLoaded={statusLoaded}
        tests={tests}
        busy={busy}
        testingProvider={testingProvider}
        filesBusy={filesBusy}
        filesProvider={filesProvider}
        files={files}
        importingId={importingId}
        onTest={handleTest}
        onListFiles={handleListFiles}
        onDisconnect={handleDisconnect}
        onImportFile={handleImportFile}
      />

      <AccountingSection
        isPaid={isPaid}
        statusLoaded={statusLoaded}
        accounting={accounting}
        accountingBusy={accountingBusy}
        onImport={handleAccountingImport}
        onDisconnect={handleAccountingDisconnect}
      />

      {isPaid && (keepSetupOpen || !notesCollapsed) && (
        <OperatorNotesSection
          statusLoaded={statusLoaded}
          statusByProvider={statusByProvider}
          accounting={accounting}
          missingSecrets={missingSecrets}
          keepSetupOpen={keepSetupOpen}
          onCollapseNotes={() => setNotesCollapsed(true)}
        />
      )}

      {isPaid && allCloudTestOk && notesCollapsed && (
        <section className="branding-card" style={{ marginTop: 20 }}>
          <p className="branding-help" style={{ margin: 0 }}>
            {t("connector.notesCollapsed")}{" "}
            <button type="button" className="btn-secondary" onClick={() => setNotesCollapsed(false)}>
              {t("connector.showAgain")}
            </button>
          </p>
        </section>
      )}

      <ApiKeySection
        isPaid={isPaid}
        loading={loading}
        busy={busy}
        keys={keys}
        newToken={newToken}
        copied={copied}
        copiedCurl={copiedCurl}
        adding={adding}
        name={name}
        onCreateTestKey={handleCreateTestKey}
        onCopyCurl={copyCurl}
        onCopyToken={copyToken}
        onDismissToken={() => setNewToken(null)}
        onRevoke={handleRevoke}
        onStartAdding={() => setAdding(true)}
        onNameChange={setName}
        onCreate={handleCreate}
        onCancelAdding={() => {
          setAdding(false);
          setName("");
        }}
      />
    </div>
  );
}
