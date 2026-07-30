import { useT } from "../../../lib/i18n";

export function SignInPanel() {
  const t = useT();
  return (
    <div className="panel">
      <h1>{t("connector.signInTitle")}</h1>
      <p className="page-sub">{t("connector.signInBody")}</p>
      <a className="btn-primary" href="/app/login">
        {t("nav.signin")}
      </a>
    </div>
  );
}
