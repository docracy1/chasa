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

  useEffect(() => {
    track("signup_started");
    void loadAuthConfig().then((cfg) => setTurnstileRequired(Boolean(cfg?.turnstileRequired)));
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
      <p className="page-sub">No password — we'll email you a link.</p>
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
