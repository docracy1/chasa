import { CLOUD_LABELS } from "../../../lib/cloudImport";
import type { CloudProvider } from "../../../lib/api";
import { useT } from "../../../lib/i18n";
import { PROVIDERS } from "../constants";
import type { ProviderTests } from "../types";
import { StatusPill } from "./StatusPill";

type ConnectorChecklistProps = {
  tests: ProviderTests;
  statusByProvider: Map<CloudProvider, { connected?: boolean; configured?: boolean }>;
  statusLoaded: boolean;
  keysCount: number;
  hasNewToken: boolean;
  apiKeyTested: boolean;
  checklistDone: boolean;
};

export function ConnectorChecklist({
  tests,
  statusByProvider,
  statusLoaded,
  keysCount,
  hasNewToken,
  apiKeyTested,
  checklistDone,
}: ConnectorChecklistProps) {
  const t = useT();

  return (
    <div className="connector-checklist">
      <h2>{t("connector.checklist")}</h2>
      <p className="branding-help" style={{ marginTop: 0 }}>
        {t("connector.checklistIntro")}
        {checklistDone ? t("connector.checklistDoneSuffix") : "."}
      </p>
      <ul className="connector-checklist-list">
        {PROVIDERS.map((p) => {
          const st = statusByProvider.get(p);
          const testState = tests[p];
          const configured = !statusLoaded || st?.configured !== false;
          const connected = !!st?.connected;
          const testOk = testState.status === "ok";
          return (
            <li key={p}>
              <strong>{CLOUD_LABELS[p]}</strong>
              <span className="connector-checklist-marks">
                <StatusPill kind={configured ? "ok" : "warn"}>
                  {configured ? t("connector.configured") : t("connector.secretsMissing")}
                </StatusPill>
                <StatusPill kind={connected ? "ok" : "muted"}>
                  {connected ? t("connector.connected") : t("connector.notConnected")}
                </StatusPill>
                <StatusPill kind={testOk ? "ok" : testState.status === "fail" ? "fail" : "muted"}>
                  {testOk
                    ? t("connector.testOk")
                    : testState.status === "fail"
                      ? t("connector.testFail")
                      : t("connector.testPending")}
                </StatusPill>
              </span>
            </li>
          );
        })}
        <li>
          <strong>{t("connector.zapierApiKey")}</strong>
          <span className="connector-checklist-marks">
            <StatusPill kind={keysCount > 0 || hasNewToken ? "ok" : "muted"}>
              {keysCount > 0 || hasNewToken ? t("connector.keyCreated") : t("connector.noKeyYet")}
            </StatusPill>
            <StatusPill kind={apiKeyTested ? "ok" : "muted"}>
              {apiKeyTested ? t("connector.curlVerified") : t("connector.copyFullCurlLabel")}
            </StatusPill>
          </span>
        </li>
      </ul>
    </div>
  );
}
