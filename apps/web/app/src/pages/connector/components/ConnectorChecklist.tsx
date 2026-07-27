import { CLOUD_LABELS } from "../../../lib/cloudImport";
import type { CloudProvider } from "../../../lib/api";
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
  return (
    <div className="connector-checklist">
      <h2>Checklist</h2>
      <p className="branding-help" style={{ marginTop: 0 }}>
        Done when all three show Connected + Test OK
        {checklistDone ? " — you’re there." : "."}
      </p>
      <ul className="connector-checklist-list">
        {PROVIDERS.map((p) => {
          const st = statusByProvider.get(p);
          const t = tests[p];
          const configured = !statusLoaded || st?.configured !== false;
          const connected = !!st?.connected;
          const testOk = t.status === "ok";
          return (
            <li key={p}>
              <strong>{CLOUD_LABELS[p]}</strong>
              <span className="connector-checklist-marks">
                <StatusPill kind={configured ? "ok" : "warn"}>
                  {configured ? "Configured" : "Secrets missing"}
                </StatusPill>
                <StatusPill kind={connected ? "ok" : "muted"}>
                  {connected ? "Connected" : "Not connected"}
                </StatusPill>
                <StatusPill kind={testOk ? "ok" : t.status === "fail" ? "fail" : "muted"}>
                  {testOk ? "Test OK" : t.status === "fail" ? "Test fail" : "Test pending"}
                </StatusPill>
              </span>
            </li>
          );
        })}
        <li>
          <strong>Zapier / API key</strong>
          <span className="connector-checklist-marks">
            <StatusPill kind={keysCount > 0 || hasNewToken ? "ok" : "muted"}>
              {keysCount > 0 || hasNewToken ? "Key created" : "No key yet"}
            </StatusPill>
            <StatusPill kind={apiKeyTested ? "ok" : "muted"}>
              {apiKeyTested ? "Curl verified" : "Copy full curl"}
            </StatusPill>
          </span>
        </li>
      </ul>
    </div>
  );
}
