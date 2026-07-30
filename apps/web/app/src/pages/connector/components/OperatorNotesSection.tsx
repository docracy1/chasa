import {
  ACCOUNTING_REDIRECT_URIS,
  ACCOUNTING_SECRET_NAMES,
  CLOUD_REDIRECT_URIS,
  CLOUD_SECRET_NAMES,
  type AccountingConnectorStatus,
  type CloudConnectorStatus,
  type CloudProvider,
} from "../../../lib/api";
import { CLOUD_LABELS } from "../../../lib/cloudImport";
import { useT } from "../../../lib/i18n";
import { ACCOUNTING_LABELS, ACCOUNTING_PROVIDERS, PROVIDERS } from "../constants";

type OperatorNotesSectionProps = {
  statusLoaded: boolean;
  statusByProvider: Map<CloudProvider, CloudConnectorStatus>;
  accounting: AccountingConnectorStatus[];
  missingSecrets: CloudConnectorStatus[];
  keepSetupOpen: boolean;
  onCollapseNotes: () => void;
};

export function OperatorNotesSection({
  statusLoaded,
  statusByProvider,
  accounting,
  missingSecrets,
  keepSetupOpen,
  onCollapseNotes,
}: OperatorNotesSectionProps) {
  const t = useT();

  return (
    <section className="branding-card connector-operator-notes" style={{ marginTop: 20 }}>
      <h2 className="webhooks-title" style={{ fontSize: "1.25rem" }}>
        {t("connector.operatorTitle")}
      </h2>
      <p className="branding-help">{t("connector.operatorBody")}</p>
      <table className="connector-ops-table">
        <thead>
          <tr>
            <th>{t("connector.colProvider")}</th>
            <th>{t("connector.colRedirect")}</th>
            <th>{t("connector.colSecrets")}</th>
          </tr>
        </thead>
        <tbody>
          {PROVIDERS.map((p) => {
            const st = statusByProvider.get(p);
            const missing = statusLoaded && st && !st.configured;
            return (
              <tr key={p}>
                <td>{CLOUD_LABELS[p]}</td>
                <td>
                  <code>{CLOUD_REDIRECT_URIS[p]}</code>
                </td>
                <td>
                  {missing ? (
                    <span className="connector-pill connector-pill-warn">
                      {t("connector.missingSecrets", {
                        secrets: CLOUD_SECRET_NAMES[p].join(" + "),
                      })}
                    </span>
                  ) : statusLoaded ? (
                    <span className="connector-pill connector-pill-ok">{t("connector.set")}</span>
                  ) : (
                    <span className="connector-pill connector-pill-muted">…</span>
                  )}
                </td>
              </tr>
            );
          })}
          {ACCOUNTING_PROVIDERS.map((p) => {
            const st = accounting.find((a) => a.provider === p);
            const missing = statusLoaded && st && !st.configured;
            const secrets = ACCOUNTING_SECRET_NAMES[p].join(" + ");
            return (
              <tr key={p}>
                <td>{ACCOUNTING_LABELS[p]}</td>
                <td>
                  <code>{ACCOUNTING_REDIRECT_URIS[p]}</code>
                </td>
                <td>
                  {missing ? (
                    <span className="connector-pill connector-pill-warn">
                      {t("connector.missingSecrets", { secrets })}
                    </span>
                  ) : st ? (
                    <span className="connector-pill connector-pill-ok">
                      {st.configured ? t("connector.set") : t("connector.missing")}
                    </span>
                  ) : (
                    <span className="connector-pill connector-pill-muted">…</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {missingSecrets.length > 0 && (
        <div className="connector-secret-help" style={{ marginTop: 14 }}>
          <p>
            <strong>{t("connector.stillMissing")}</strong> (
            {missingSecrets.map((s) => CLOUD_LABELS[s.provider]).join(", ")}):
          </p>
          <pre className="connector-pre">
            {missingSecrets
              .flatMap((s) => CLOUD_SECRET_NAMES[s.provider].map((n) => `wrangler secret put ${n}`))
              .join("\n")}
          </pre>
        </div>
      )}
      {statusLoaded && accounting.some((a) => !a.configured) && (
        <div className="connector-secret-help" style={{ marginTop: 14 }}>
          <p>
            <strong>{t("connector.accountingSecretsMissing")}</strong> (
            {accounting
              .filter((a) => !a.configured)
              .map((a) => ACCOUNTING_LABELS[a.provider])
              .join(", ")}
            ):
          </p>
          <pre className="connector-pre">
            {accounting
              .filter((a) => !a.configured)
              .flatMap((a) =>
                ACCOUNTING_SECRET_NAMES[a.provider].map((n) => `wrangler secret put ${n}`)
              )
              .join("\n")}
          </pre>
        </div>
      )}
      {missingSecrets.length === 0 && statusLoaded && (
        <p className="branding-help">{t("connector.allCloudConfigured")}</p>
      )}
      {!keepSetupOpen && (
        <button
          type="button"
          className="btn-secondary"
          style={{ marginTop: 12 }}
          onClick={onCollapseNotes}
        >
          {t("connector.collapseOperatorNotes")}
        </button>
      )}
    </section>
  );
}
