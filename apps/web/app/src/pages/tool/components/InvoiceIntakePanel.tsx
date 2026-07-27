import { Link } from "react-router-dom";
import { track } from "../../../lib/analytics";
import type { Invoice } from "../types";

interface InvoiceIntakePanelProps {
  clientName: string;
  amount: string;
  dueDate: string;
  paymentLink: string;
  isPaid: boolean;
  invoices: Invoice[];
  onClientNameChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
  onPaymentLinkChange: (value: string) => void;
  onAddManual: (e: React.FormEvent) => void;
  onCsvUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenPdfPicker: () => void;
  onDownloadCsv: () => void;
  onClearList: () => void;
}

export function InvoiceIntakePanel({
  clientName,
  amount,
  dueDate,
  paymentLink,
  isPaid,
  invoices,
  onClientNameChange,
  onAmountChange,
  onDueDateChange,
  onPaymentLinkChange,
  onAddManual,
  onCsvUpload,
  onOpenPdfPicker,
  onDownloadCsv,
  onClearList,
}: InvoiceIntakePanelProps) {
  return (
    <div className="panel">
      <form onSubmit={onAddManual}>
        <div className="field-row">
          <input
            type="text"
            placeholder="Client name"
            value={clientName}
            onChange={(e) => onClientNameChange(e.target.value)}
          />
          <input
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            step="0.01"
          />
          <input type="date" value={dueDate} onChange={(e) => onDueDateChange(e.target.value)} />
          <button type="submit" className="btn-primary">
            Add
          </button>
        </div>
      </form>
      <div className="payment-link-row">
        <label htmlFor="payment-link">
          Payment link <span className="optional-tag">(optional)</span>
        </label>
        <input
          id="payment-link"
          type="url"
          placeholder="https://buy.stripe.com/… or PayPal.me / Wise"
          value={paymentLink}
          onChange={(e) => onPaymentLinkChange(e.target.value)}
        />
        {isPaid ? (
          <Link className="branding-help" to="/branding">
            Set account default
          </Link>
        ) : (
          <span className="branding-help">Saved in this browser · Solo+ for account default</span>
        )}
      </div>
      <label className="btn-secondary" style={{ cursor: "pointer" }}>
        Upload CSV
        <input type="file" accept=".csv" onChange={onCsvUpload} style={{ display: "none" }} />
      </label>
      {isPaid ? (
        <button
          type="button"
          className="btn-secondary"
          style={{ marginLeft: 8 }}
          onClick={() => void onOpenPdfPicker()}
        >
          Import PDF
        </button>
      ) : (
        <Link className="btn-secondary" style={{ marginLeft: 8 }} to="/connector">
          PDF import (Solo+)
        </Link>
      )}
      {isPaid && invoices.some((inv) => inv.draft) && (
        <button className="btn-secondary" style={{ marginLeft: 8 }} onClick={onDownloadCsv}>
          Download all as CSV
        </button>
      )}
      {invoices.length > 0 && (
        <button
          type="button"
          className="btn-secondary"
          style={{ marginLeft: 8 }}
          onClick={() => {
            if (confirm("Clear all invoices from this session?")) {
              onClearList();
              track("aging_cleared");
            }
          }}
        >
          Clear list
        </button>
      )}
    </div>
  );
}
