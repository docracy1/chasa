import { Link } from "react-router-dom";
import { ConnectorChecklist } from "./ConnectorChecklist";
import type { CloudProvider } from "../../../lib/api";
import type { ProviderTests } from "../types";
import { useT } from "../../../lib/i18n";

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
  const t = useT();
  return (
    <section className="branding-card connector-test-hero">
      <h1 className="webhooks-title">{t("connector.title")}</h1>
      <p className="branding-help">
        {t("connector.hero")}{" "}
        <strong>{t("connector.neverEmails")}</strong>
        {t("connector.heroSend")}
      </p>
      <ol className="connector-how-list">
        <li>{t("connector.cloudStep")}</li>
        <li>{t("connector.accountingStep")}</li>
        <li>{t("connector.zapierStep")}</li>
      </ol>
      <p className="branding-help">{t("connector.afterImport")}</p>

      {!isPaid && (
        <div className="upgrade-nudge">
          {t("connector.upgradeNudge")}{" "}
          <Link to="/account">{t("connector.upgradeLink")}</Link>
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
            {t("connector.allTested")}
            <button
              type="button"
              className="btn-secondary"
              style={{ marginLeft: 12 }}
              onClick={onExpandChecklist}
            >
              {t("connector.showChecklist")}
            </button>
          </p>
        </div>
      )}

      {allCloudTestOk && !notesCollapsed && (
        <p className="branding-help">
          <button type="button" className="btn-secondary" onClick={onCollapseChecklist}>
            {t("connector.collapseChecklist")}
          </button>
        </p>
      )}
    </section>
  );
}
