import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  createWebhook,
  deleteWebhook,
  listWebhooks,
  type Account,
  type WebhookItem,
} from "../lib/api";

export default function WebhooksPage({ account }: { account: Account | null }) {
  const [hooks, setHooks] = useState<WebhookItem[]>([]);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isPaid = !!account && account.plan !== "free";

  async function refresh() {
    if (!account || !isPaid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await listWebhooks();
      setHooks(res.webhooks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load webhooks");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.email, isPaid]);

  if (!account) {
    return (
      <div className="panel">
        <h1>Webhooks</h1>
        <p className="page-sub">Sign in to manage webhooks.</p>
        <a className="btn-primary" href="/app/login">
          Sign in
        </a>
      </div>
    );
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!isPaid) return;
    setBusy(true);
    setError(null);
    try {
      await createWebhook(url.trim());
      setUrl("");
      setAdding(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add webhook");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!isPaid) return;
    setBusy(true);
    setError(null);
    try {
      await deleteWebhook(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete webhook");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="webhooks-page">
      <p className="crumb">
        <Link to="/account">Account</Link> / Webhooks
      </p>
      <section className="branding-card">
        <h1 className="webhooks-title">Webhooks</h1>
        <p className="branding-help">
          Get notified at a URL you control when a chase is drafted, sent, or completed in your
          workflow. Payload is JSON — nothing is emailed for you.
        </p>

        {!isPaid && (
          <div className="upgrade-nudge">
            Webhooks are included on Solo and up. <Link to="/account">Upgrade</Link> to add endpoints.
          </div>
        )}

        {loading ? (
          <p className="page-sub">Loading…</p>
        ) : hooks.length === 0 ? (
          <p className="webhooks-empty">No webhooks yet.</p>
        ) : (
          <ul className="webhooks-list">
            {hooks.map((h) => (
              <li key={h.id}>
                <code>{h.url}</code>
                {isPaid && (
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={busy}
                    onClick={() => handleDelete(h.id)}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {isPaid && !adding && (
          <button type="button" className="btn-primary" onClick={() => setAdding(true)}>
            + Add webhook
          </button>
        )}

        {isPaid && adding && (
          <form className="webhooks-add" onSubmit={handleAdd}>
            <input
              type="url"
              required
              placeholder="https://example.com/hooks/chasa"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={busy}
            />
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => {
                setAdding(false);
                setUrl("");
              }}
            >
              Cancel
            </button>
          </form>
        )}

        {error && <div className="error-msg">{error}</div>}

        <div className="webhooks-events">
          <h2>Events</h2>
          <ul>
            <li>
              <code>chase.drafted</code> — follow-up draft generated
            </li>
            <li>
              <code>chase.sent</code> — draft copied / opened in mail client
            </li>
            <li>
              <code>chase.thank_you</code> — thank-you draft generated
            </li>
            <li>
              <code>chase.reply_drafted</code> — reply to client message
            </li>
            <li>
              <code>chase.sequence_planned</code> — 3-step chase plan (Pro)
            </li>
            <li>
              <code>chase.downloaded</code> — CSV export of drafts
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
