import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  acceptTeamInvite,
  getTeam,
  inviteTeamMember,
  removeTeamMember,
  updateTeamMemberRole,
  type Account,
  type TeamInfo,
} from "../lib/api";

export default function TeamPage({
  account,
  refresh,
}: {
  account: Account | null;
  refresh: () => Promise<void>;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  const isPaid = !!account && account.plan !== "free";

  async function load() {
    const t = await getTeam();
    setTeam(t);
  }

  useEffect(() => {
    if (!account || !isPaid) return;
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load team"));
  }, [account, isPaid]);

  useEffect(() => {
    const token = searchParams.get("invite");
    if (!token || !account || !isPaid || accepted) return;
    setBusy(true);
    acceptTeamInvite(token)
      .then(async () => {
        setAccepted(true);
        setSearchParams({}, { replace: true });
        await refresh();
        await load();
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not accept invite"))
      .finally(() => setBusy(false));
  }, [account, isPaid, searchParams, accepted]);

  if (!account) {
    return (
      <div className="panel">
        <h1>Team</h1>
        <p className="page-sub">Sign in on Solo or higher to invite teammates.</p>
        <Link className="btn-primary" to="/login">
          Sign in
        </Link>
      </div>
    );
  }

  if (!isPaid) {
    return (
      <div className="panel">
        <h1>Team</h1>
        <p className="page-sub">
          Invite teammates with admin/member roles. Solo includes 3 seats; Pro 5; Enterprise 25.
        </p>
        <div className="upgrade-nudge">
          <Link to="/account">Upgrade to Solo</Link> to unlock team seats.
        </div>
      </div>
    );
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    setInviteUrl(null);
    try {
      const res = await inviteTeamMember(email.trim(), role);
      setInviteUrl(res.inviteUrl);
      setEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h1>Team</h1>
      <p className="page-sub">
        Workspace owner: {team?.ownerEmail ?? "…"} · {team?.seats.used ?? "—"} /{" "}
        {team?.seats.limit ?? "—"} seats · your role: {team?.yourRole ?? account.role ?? "admin"}
      </p>
      {accepted && <div className="success-msg">Invite accepted — you&apos;re in this workspace.</div>}
      {error && <div className="error-msg">{error}</div>}

      {team?.yourRole === "admin" && (
        <form className="team-invite-form" onSubmit={handleInvite} style={{ marginBottom: 24 }}>
          <label>
            Invite by email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@company.com"
              required
            />
          </label>
          <label>
            Role
            <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "member")}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button className="btn-primary" type="submit" disabled={busy || (team?.seats.remaining ?? 0) <= 0}>
            {busy ? "Sending…" : "Send invite"}
          </button>
        </form>
      )}

      {inviteUrl && (
        <p className="page-sub" style={{ marginBottom: 16 }}>
          Invite sent. Share link if needed: <code>{inviteUrl}</code>
        </p>
      )}

      <ul className="team-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        <li style={{ padding: "10px 0", borderBottom: "1px solid var(--line, #e5e5e5)" }}>
          <strong>{team?.ownerEmail}</strong> · owner (admin)
        </li>
        {(team?.members ?? []).map((m) => (
          <li
            key={m.id}
            style={{
              padding: "10px 0",
              borderBottom: "1px solid var(--line, #e5e5e5)",
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <strong>{m.email}</strong>
            <span className="page-sub" style={{ margin: 0 }}>
              {m.role} · {m.status}
            </span>
            {team?.yourRole === "admin" && (
              <>
                <select
                  value={m.role}
                  onChange={async (e) => {
                    try {
                      await updateTeamMemberRole(m.id, e.target.value as "admin" | "member");
                      await load();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Update failed");
                    }
                  }}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={async () => {
                    try {
                      await removeTeamMember(m.id);
                      await load();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Remove failed");
                    }
                  }}
                >
                  Remove
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
