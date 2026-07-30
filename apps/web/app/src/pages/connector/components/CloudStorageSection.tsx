import type { CloudConnectorStatus, CloudFile, CloudProvider } from "../../../lib/api";
import { useT } from "../../../lib/i18n";
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
  const t = useT();

  return (
    <section className="branding-card" style={{ marginTop: 20 }}>
      <h2 className="webhooks-title" style={{ fontSize: "1.25rem" }}>
        {t("connector.cloudTitle")}
      </h2>
      <p className="branding-help">{t("connector.cloudBody")}</p>
      <ol className="connector-how-list">
        <li>{t("connector.howConnect")}</li>
        <li>{t("connector.howTest")}</li>
        <li>{t("connector.howPdfs")}</li>
        <li>{t("connector.howFinish")}</li>
      </ol>

      {loading && isPaid ? (
        <p className="page-sub">{t("common.loading")}</p>
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
