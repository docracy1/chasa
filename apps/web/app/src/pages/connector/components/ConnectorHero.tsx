import { Link } from "react-router-dom";
import { ConnectorChecklist } from "./ConnectorChecklist";
import type { CloudProvider } from "../../../lib/api";
import type { ProviderTests } from "../types";

type ConnectorHeroProps = {
  isPaid: boolean;
  cloudMsg: string | null;
  error: string | null;
  keepSetupOpen: boolean;
  notesCollapsed: boolean;
  allCloudTestOk: boolean;
  checklistDone: boolean;
  tests: ProviderTests;
  statusByProvider: Map<CloudProvider, { connected?: boolean; configured?: boolean }>;
  statusLoaded: boolean;
  keysCount: number;
  hasNewToken: boolean;
  apiKeyTested: boolean;
  onExpandChecklist: () => void;
  onCollapseChecklist: () => void;
};

export function ConnectorHero({
  isPaid,
  cloudMsg,
  error,
  keepSetupOpen,
  notesCollapsed,
  allCloudTestOk,
  checklistDone,
  tests,
  statusByProvider,
  statusLoaded,
  keysCount,
  hasNewToken,
  apiKeyTested,
  onExpandChecklist,
  onCollapseChecklist,
}: ConnectorHeroProps) {
  return (
    <section className="branding-card connector-test-hero">
      <h1 className="webhooks-title">Connectors</h1>
      <p className="branding-help">
        Bring unpaid invoices into Chasa from cloud storage, QuickBooks/Xero, or Zapier — then draft
        follow-ups in the Tool. <strong>Chasa never emails your clients</strong>; you always send
        from your own inbox.
      </p>
      <ol className="connector-how-list">
        <li>
          <strong>Cloud storage</strong> — connect Dropbox, OneDrive, or Box → import invoice PDFs
        </li>
        <li>
          <strong>Accounting</strong> — connect QuickBooks Online or Xero → import overdue invoices
        </li>
        <li>
          <strong>Zapier / API</strong> — push overdue invoices from FreshBooks, Wave, Zoho, and
          more into a chase draft
        </li>
      </ol>
      <p className="branding-help">
        After import, open the <a href="/app/">Tool</a> to generate AI follow-ups.
      </p>

      {!isPaid && (
        <div className="upgrade-nudge">
          Cloud storage and API keys are on Solo ($7), Pro ($17), and Enterprise.{" "}
          <Link to="/account">Upgrade</Link> to run this checklist.
        </div>
      )}

      {cloudMsg && <div className="connector-ok-msg">{cloudMsg}</div>}
      {error && <div className="error-msg">{error}</div>}

      {(keepSetupOpen || !notesCollapsed) && (
        <ConnectorChecklist
          tests={tests}
          statusByProvider={statusByProvider}
          statusLoaded={statusLoaded}
          keysCount={keysCount}
          hasNewToken={hasNewToken}
          apiKeyTested={apiKeyTested}
          checklistDone={checklistDone}
        />
      )}

      {allCloudTestOk && notesCollapsed && (
        <div className="connector-checklist connector-checklist-compact">
          <p>
            All three cloud connectors tested OK.
            <button
              type="button"
              className="btn-secondary"
              style={{ marginLeft: 12 }}
              onClick={onExpandChecklist}
            >
              Show checklist
            </button>
          </p>
        </div>
      )}

      {allCloudTestOk && !notesCollapsed && (
        <p className="branding-help">
          <button type="button" className="btn-secondary" onClick={onCollapseChecklist}>
            Collapse checklist
          </button>
        </p>
      )}
    </section>
  );
}
