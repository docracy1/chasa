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
