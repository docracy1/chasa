import { useEffect, useState } from "react";
import { requestMagicLink } from "../lib/api";
import { track } from "../lib/analytics";
import TurnstileWidget, { resetTurnstile } from "../components/TurnstileWidget";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  useEffect(() => {
    track("signup_started");
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Sending…" : "Send link"}
          </button>
        </div>
        <TurnstileWidget onToken={setTurnstileToken} />
      </form>
      {error && <div className="error-msg">{error}</div>}
    </div>
  );
}
