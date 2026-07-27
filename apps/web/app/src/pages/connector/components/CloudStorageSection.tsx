import type { CloudConnectorStatus, CloudFile, CloudProvider } from "../../../lib/api";
import { CloudConnectorCard } from "./CloudConnectorCard";
import { CloudFilesPanel } from "./CloudFilesPanel";
import type { ProviderTests } from "../types";

type CloudStorageSectionProps = {
  loading: boolean;
  isPaid: boolean;
  rows: CloudConnectorStatus[];
  statusLoaded: boolean;
  tests: ProviderTests;
  busy: boolean;
  testingProvider: CloudProvider | null;
  filesBusy: boolean;
  filesProvider: CloudProvider | null;
  files: CloudFile[];
  importingId: string | null;
  onTest: (provider: CloudProvider) => void;
  onListFiles: (provider: CloudProvider) => void;
  onDisconnect: (provider: CloudProvider) => void;
  onImportFile: (provider: CloudProvider, file: CloudFile) => void;
};

export function CloudStorageSection({
  loading,
  isPaid,
  rows,
  statusLoaded,
  tests,
  busy,
  testingProvider,
  filesBusy,
  filesProvider,
  files,
  importingId,
  onTest,
  onListFiles,
  onDisconnect,
  onImportFile,
}: CloudStorageSectionProps) {
  return (
    <section className="branding-card" style={{ marginTop: 20 }}>
      <h2 className="webhooks-title" style={{ fontSize: "1.25rem" }}>
        Cloud storage (PDF import)
      </h2>
      <p className="branding-help">
        Use this when invoice PDFs live in Dropbox, OneDrive, or Box. Chasa reads the PDF, extracts
        client / amount / due date hints, and adds a row in the Tool so you can draft a chase email.
      </p>
      <ol className="connector-how-list">
        <li>
          Click <strong>Connect</strong> and approve access in the provider
        </li>
        <li>
          Click <strong>Test</strong> once (optional) to confirm the link works
        </li>
        <li>
          Click <strong>Recent PDFs</strong> → <strong>Import</strong> on the file you want
        </li>
        <li>
          Finish the import in the <a href="/app/">Tool</a>, then generate the follow-up
        </li>
      </ol>

      {loading && isPaid ? (
        <p className="page-sub">Loading…</p>
      ) : (
        <ul className="cloud-connector-list connector-cards">
          {rows.map((c) => (
            <CloudConnectorCard
              key={c.provider}
              connector={c}
              test={tests[c.provider]}
              statusLoaded={statusLoaded}
              isPaid={isPaid}
              busy={busy}
              testingProvider={testingProvider}
              filesBusy={filesBusy}
              filesProvider={filesProvider}
              onTest={onTest}
              onListFiles={onListFiles}
              onDisconnect={onDisconnect}
            />
          ))}
        </ul>
      )}

      {filesProvider && (
        <CloudFilesPanel
          filesProvider={filesProvider}
          files={files}
          filesBusy={filesBusy}
          importingId={importingId}
          onImportFile={onImportFile}
        />
      )}
    </section>
  );
}
