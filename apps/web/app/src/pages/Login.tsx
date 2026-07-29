import { useEffect, useState } from "react";
import { requestMagicLink, type AuthConfig } from "../lib/api";
import { track } from "../lib/analytics";
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
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileRequired, setTurnstileRequired] = useState(false);
  const [googleLoginEnabled, setGoogleLoginEnabled] = useState(false);

  useEffect(() => {
    track("signup_started");
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err === "google_auth" || err === "google_unavailable") {
      setError("Google sign-in failed. Try again, or use the email link below.");
    }
    void loadAuthConfig().then((cfg) => {
      setTurnstileRequired(Boolean(cfg?.turnstileRequired));
      setGoogleLoginEnabled(Boolean(cfg?.googleLoginEnabled));
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (turnstileRequired && !turnstileToken) {
      setError("Complete the security check and try again.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await requestMagicLink(email, turnstileToken);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setTurnstileToken(null);
      resetTurnstile();
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="panel">
        <h1>Check your email</h1>
        <p className="page-sub">
          We sent a sign-in link to {email}. Click it to log in — it expires in 15 minutes.
        </p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h1>Sign in</h1>
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
            Continue with Google
          </a>
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
            <div style={{ flex: 1, height: 1, background: "var(--hairline, #ddd)" }} />
            <span style={{ fontSize: 12, color: "var(--mute, #888)", whiteSpace: "nowrap" }}>
              or sign in with email
            </span>
            <div style={{ flex: 1, height: 1, background: "var(--hairline, #ddd)" }} />
          </div>
        </>
      ) : (
        <p className="page-sub">No password — we'll email you a link.</p>
      )}
      <form onSubmit={handleSubmit}>
        <div className="field-row" style={{ gridTemplateColumns: "1fr auto" }}>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={submitting || (turnstileRequired && !turnstileToken)}
          >
            {submitting ? "Sending…" : "Send link"}
          </button>
        </div>
        <TurnstileWidget onToken={setTurnstileToken} />
      </form>
      {error && <div className="error-msg">{error}</div>}
    </div>
  );
}
