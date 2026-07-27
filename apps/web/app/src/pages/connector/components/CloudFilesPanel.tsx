import type { CloudFile, CloudProvider } from "../../../lib/api";
import { CLOUD_LABELS } from "../../../lib/cloudImport";

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
  return (
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
                onClick={() => onImportFile(filesProvider, f)}
              >
                {importingId === f.id ? "Importing…" : "Import to Tool"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
