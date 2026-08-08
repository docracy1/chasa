import { useEffect, useRef, useState } from "react";
import { adminPasswordLogin, requestMagicLink, type AuthConfig } from "../lib/api";
import { track } from "../lib/analytics";
import { useT } from "../lib/i18n";
import TurnstileWidget, { resetTurnstile } from "../components/TurnstileWidget";

async function loadAuthConfig(): Promise<AuthConfig | null> {
  try {
    const res = await fetch("/api/auth/config", { credentials: "include" });
    if (!res.ok) return null;
    return (await res.json()) as AuthConfig;
  } catch {
    return null;
  }
}

export default function Login() {
  const t = useT();
  const params = new URLSearchParams(window.location.search);
  const emailFromUrl = (params.get("email") || "").trim();
  const autoStart = params.get("start") === "1" && Boolean(emailFromUrl);

  const [email, setEmail] = useState(emailFromUrl);
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileRequired, setTurnstileRequired] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [googleLoginEnabled, setGoogleLoginEnabled] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const autoStartedRef = useRef(false);

  useEffect(() => {
    track("signup_started");
    const err = params.get("error");
    if (err === "google_auth" || err === "google_unavailable") {
      setError("google_auth");
    }
    void loadAuthConfig().then((cfg) => {
      setTurnstileRequired(Boolean(cfg?.turnstileRequired));
      setGoogleLoginEnabled(Boolean(cfg?.googleLoginEnabled));
      setAdminEmail(cfg?.adminEmail?.trim().toLowerCase() || null);
      setConfigLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read URL once on mount
  }, []);

  const isAdminEmail =
    Boolean(adminEmail) && email.trim().toLowerCase() === adminEmail;

  const displayError =
    error === "google_auth" ? t("login.googleFailed") : error;

  async function sendMagicLink(currentEmail: string, token: string | null) {
    setSubmitting(true);
    setError(null);
    try {
      await requestMagicLink(currentEmail, token);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.genericError"));
      setTurnstileToken(null);
      resetTurnstile();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (turnstileRequired && !turnstileToken) {
      setError(t("login.turnstile"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (isAdminEmail) {
        await adminPasswordLogin(email, password, turnstileToken);
        window.location.href = "/app/account";
        return;
      }
      await requestMagicLink(email, turnstileToken);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.genericError"));
      setTurnstileToken(null);
      resetTurnstile();
    } finally {
      setSubmitting(false);
    }
  }

  // Hero "Start free" lands here with ?email=&start=1 — send the magic link once ready.
  useEffect(() => {
    if (!autoStart || !configLoaded || autoStartedRef.current || sent || submitting) return;
    if (isAdminEmail) return;
    if (turnstileRequired && !turnstileToken) return;
    autoStartedRef.current = true;
    void sendMagicLink(email, turnstileToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    autoStart,
    configLoaded,
    email,
    isAdminEmail,
    sent,
    submitting,
    turnstileRequired,
    turnstileToken,
  ]);

  if (sent) {
    return (
      <div className="panel">
        <h1>{t("login.sentTitle")}</h1>
        <p className="page-sub">
          {autoStart ? t("login.sentBodySignup", { email }) : t("login.sentBody", { email })}
        </p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h1>{autoStart ? t("login.titleSignup") : t("login.title")}</h1>
      {googleLoginEnabled ? (
        <>
          <a
            href="/api/auth/google"
            className="btn-secondary"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              textDecoration: "none",
              width: "100%",
              marginBottom: 4,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.49-1.47-.76-3.04-.76-4.59s.27-3.12.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.55 10.78l7.98-6.19z" />
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.55 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            </svg>
            {t("login.google")}
          </a>
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
            <div style={{ flex: 1, height: 1, background: "var(--hairline, #ddd)" }} />
            <span style={{ fontSize: 12, color: "var(--mute, #888)", whiteSpace: "nowrap" }}>
              {t("login.orEmailShort")}
            </span>
            <div style={{ flex: 1, height: 1, background: "var(--hairline, #ddd)" }} />
          </div>
        </>
      ) : (
        <p className="page-sub">
          {isAdminEmail
            ? t("login.subAdmin")
            : autoStart
              ? t("login.subSignup")
              : t("login.sub")}
        </p>
      )}
      <form onSubmit={handleSubmit}>
        <div
          className="field-row"
          style={{ gridTemplateColumns: isAdminEmail ? "1fr" : "1fr auto" }}
        >
          <input
            type="email"
            placeholder={t("login.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          {!isAdminEmail && (
            <button
              type="submit"
              className="btn-primary"
              disabled={submitting || (turnstileRequired && !turnstileToken)}
            >
              {submitting
                ? t("login.sending")
                : autoStart
                  ? t("login.ctaSignup")
                  : t("login.cta")}
            </button>
          )}
        </div>
        {isAdminEmail && (
          <>
            <div className="field-row" style={{ gridTemplateColumns: "1fr", marginTop: 10 }}>
              <input
                type="password"
                placeholder={t("login.passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="btn-primary"
              style={{ width: "100%", marginTop: 10 }}
              disabled={submitting || (turnstileRequired && !turnstileToken)}
            >
              {submitting ? t("login.signingIn") : t("login.signIn")}
            </button>
          </>
        )}
        <TurnstileWidget onToken={setTurnstileToken} />
      </form>
      {displayError && <div className="error-msg">{displayError}</div>}
    </div>
  );
}
