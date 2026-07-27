import type { PendingCloudImport } from "../types";

interface CloudImportConfirmProps {
  pendingImport: PendingCloudImport;
  importClient: string;
  importAmount: string;
  importDue: string;
  onImportClientChange: (value: string) => void;
  onImportAmountChange: (value: string) => void;
  onImportDueChange: (value: string) => void;
  onConfirm: (e: React.FormEvent) => void;
  onDismiss: () => void;
}

export function CloudImportConfirm({
  pendingImport,
  importClient,
  importAmount,
  importDue,
  onImportClientChange,
  onImportAmountChange,
  onImportDueChange,
  onConfirm,
  onDismiss,
}: CloudImportConfirmProps) {
  return (
    <div className="panel cloud-import-panel">
      <h2 className="cloud-import-title">Confirm PDF import</h2>
      <p className="branding-help">
        From {pendingImport.providerLabel}: <code>{pendingImport.file.name}</code>
        {pendingImport.hints.confidence !== "none"
          ? ` · hints confidence: ${pendingImport.hints.confidence}`
          : " · no fields auto-detected — fill them in below"}
      </p>
      <form onSubmit={onConfirm}>
        <div className="field-row">
          <input
            type="text"
            placeholder="Client name"
            value={importClient}
            onChange={(e) => onImportClientChange(e.target.value)}
          />
          <input
            type="number"
            placeholder="Amount"
            value={importAmount}
            onChange={(e) => onImportAmountChange(e.target.value)}
            step="0.01"
          />
          <input
            type="date"
            value={importDue}
            onChange={(e) => onImportDueChange(e.target.value)}
          />
          <button type="submit" className="btn-primary">
            Add invoice
          </button>
          <button type="button" className="btn-secondary" onClick={onDismiss}>
            Dismiss
          </button>
        </div>
      </form>
      {pendingImport.textPreview ? (
        <details className="cloud-import-preview">
          <summary>
            Extracted text preview ({pendingImport.extractedChars} chars) — copy if useful
          </summary>
          <pre>{pendingImport.textPreview}</pre>
        </details>
      ) : (
        <p className="branding-help">
          No extractable text found (scanned PDF?). Enter the fields manually from the filename
          or open the file in {pendingImport.providerLabel}.
        </p>
      )}
    </div>
  );
}
