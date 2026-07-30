import type { CloudFile, CloudProvider } from "../../../lib/api";
import { CLOUD_LABELS } from "../../../lib/cloudImport";
import { useT } from "../../../lib/i18n";

type CloudFilesPanelProps = {
  filesProvider: CloudProvider;
  files: CloudFile[];
  filesBusy: boolean;
  importingId: string | null;
  onImportFile: (provider: CloudProvider, file: CloudFile) => void;
};

export function CloudFilesPanel({
  filesProvider,
  files,
  filesBusy,
  importingId,
  onImportFile,
}: CloudFilesPanelProps) {
  const t = useT();

  return (
    <div className="cloud-files">
      <h2>{t("connector.recentPdfsNamed", { provider: CLOUD_LABELS[filesProvider] })}</h2>
      {files.length === 0 && !filesBusy ? (
        <p className="branding-help">{t("connector.noPdfs")}</p>
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
                onClick={() => onImportFile(filesProvider, f)}
              >
                {importingId === f.id ? t("connector.importing") : t("connector.importToTool")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
