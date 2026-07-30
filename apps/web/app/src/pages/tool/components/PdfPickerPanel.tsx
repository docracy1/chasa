import { Link } from "react-router-dom";
import type { CloudFile, CloudProvider } from "../../../lib/api";
import { useT } from "../../../lib/i18n";
import { CLOUD_LABELS } from "../constants";

interface PdfPickerPanelProps {
  pdfError: string | null;
  pdfBusy: boolean;
  pdfProviders: CloudProvider[];
  pdfProvider: CloudProvider | null;
  pdfFiles: CloudFile[];
  onClose: () => void;
  onLoadPdfFiles: (provider: CloudProvider) => void;
  onImportPdf: (file: CloudFile) => void;
}

export function PdfPickerPanel({
  pdfError,
  pdfBusy,
  pdfProviders,
  pdfProvider,
  pdfFiles,
  onClose,
  onLoadPdfFiles,
  onImportPdf,
}: PdfPickerPanelProps) {
  const t = useT();
  return (
    <div className="panel cloud-import-panel">
      <div className="cloud-import-picker-head">
        <h2 className="cloud-import-title">{t("pdf.title")}</h2>
        <button type="button" className="btn-secondary" onClick={onClose}>
          {t("common.close")}
        </button>
      </div>
      {pdfError && <div className="error-msg">{pdfError}</div>}
      {pdfBusy && <p className="page-sub">{t("common.loading")}</p>}
      {!pdfBusy && pdfProviders.length === 0 && (
        <p className="branding-help">
          {t("pdf.noCloud")}{" "}
          <Link to="/connector">{t("pdf.connectCloud")}</Link>.
        </p>
      )}
      {pdfProviders.length > 1 && (
        <div className="cloud-import-provider-tabs">
          {pdfProviders.map((p) => (
            <button
              key={p}
              type="button"
              className={pdfProvider === p ? "btn-primary" : "btn-secondary"}
              disabled={pdfBusy}
              onClick={() => void onLoadPdfFiles(p)}
            >
              {CLOUD_LABELS[p]}
            </button>
          ))}
        </div>
      )}
      {pdfProvider && !pdfBusy && pdfFiles.length === 0 && (
        <p className="branding-help">{t("pdf.noneFound")}</p>
      )}
      {pdfFiles.length > 0 && (
        <ul className="cloud-files-list">
          {pdfFiles.map((f) => (
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
                disabled={pdfBusy}
                onClick={() => void onImportPdf(f)}
              >
                {t("pdf.import")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
