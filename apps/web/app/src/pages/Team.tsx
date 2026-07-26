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

function emailInitials(email: string): string {
  const local = email.split("@")[0]?.trim() || "?";
  const parts = local.split(/[._\-+]/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

function roleLabel(role: string): string {
  return role === "admin" ? "Admin" : "Member";
}

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
  const seatsUsed = team?.seats.used ?? 0;
  const seatsLimit = team?.seats.limit ?? 0;
  const seatsPct =
    seatsLimit > 0 ? Math.min(100, Math.round((seatsUsed / seatsLimit) * 100)) : 0;

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
      <div className="team-page">
        <p className="crumb">
          <Link to="/account">Account</Link> / Team
        </p>
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
      <div className="team-page">
        <p className="crumb">
          <Link to="/account">Account</Link> / Team
        </p>
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

  const yourRole = team?.yourRole ?? account.role ?? "admin";
  const isAdmin = yourRole === "admin";

  return (
    <div className="team-page">
      <p className="crumb">
        <Link to="/account">Account</Link> / Team
      </p>
      <h1>Team</h1>
      <p className="page-sub">
        Invite teammates to this workspace. You&apos;re signed in as{" "}
        <strong>{account.email}</strong> · role{" "}
        <span className={`team-role-badge ${yourRole}`}>{roleLabel(yourRole)}</span>
      </p>

      {accepted && <div className="success-msg">Invite accepted — you&apos;re in this workspace.</div>}
      {error && <div className="error-msg">{error}</div>}

      <section className="branding-card team-seats-card">
        <div className="team-seats-head">
          <div>
            <h2>Seats</h2>
            <p className="branding-help">
              {seatsLimit > 0 ? (
                <>
                  <strong>
                    {seatsUsed} of {seatsLimit}
                  </strong>{" "}
                  seats used
                  {team?.ownerEmail ? (
                    <>
                      {" "}
                      · workspace owner <strong>{team.ownerEmail}</strong>
                    </>
                  ) : null}
                </>
              ) : (
                "Loading seat usage…"
              )}
            </p>
          </div>
          <span className="team-seats-count">
            {seatsUsed}/{seatsLimit || "—"}
          </span>
        </div>
        <div
          className="team-seats-track"
          role="progressbar"
          aria-valuenow={seatsUsed}
          aria-valuemin={0}
          aria-valuemax={seatsLimit || 1}
          aria-label="Seat usage"
        >
          <div className="team-seats-fill" style={{ width: `${seatsPct}%` }} />
        </div>
      </section>

      {isAdmin && (
        <section className="branding-card">
          <h2>Invite by email</h2>
          <p className="branding-help">
            Sends an invite link. Admins can manage members and billing-related settings; members can
            work in the workspace.
          </p>
          <form className="team-invite-form" onSubmit={handleInvite}>
            <label className="team-invite-email">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@company.com"
                required
                disabled={busy}
                autoComplete="email"
              />
            </label>
            <label className="team-invite-role">
              Role
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "admin" | "member")}
                disabled={busy}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <button
              className="btn-primary team-invite-submit"
              type="submit"
              disabled={busy || (team?.seats.remaining ?? 0) <= 0}
            >
              {busy ? "Sending…" : "Send invite"}
            </button>
          </form>
          {inviteUrl && (
            <p className="team-invite-link">
              Invite sent. Share link if needed: <code>{inviteUrl}</code>
            </p>
          )}
          {(team?.seats.remaining ?? 0) <= 0 && (
            <p className="team-invite-full">All seats are used. Upgrade or remove a member to invite more.</p>
          )}
        </section>
      )}

      <section className="branding-card">
        <h2>Members</h2>
        <p className="branding-help">People with access to this workspace.</p>
        <ul className="team-list">
          <li className="team-member-row">
            <span className="team-avatar" aria-hidden>
              {emailInitials(team?.ownerEmail ?? account.email)}
            </span>
            <div className="team-member-main">
              <strong>{team?.ownerEmail ?? "…"}</strong>
              <span className="team-member-meta">Workspace owner</span>
            </div>
            <span className="team-role-badge admin">Owner</span>
          </li>
          {(team?.members ?? []).map((m) => (
            <li key={m.id} className="team-member-row">
              <span className="team-avatar" aria-hidden>
                {emailInitials(m.email)}
              </span>
              <div className="team-member-main">
                <strong>{m.email}</strong>
                <span className="team-member-meta">
                  {m.status === "pending" ? "Invite pending" : "Active"}
                  {m.joinedAt
                    ? ` · joined ${new Date(m.joinedAt).toLocaleDateString()}`
                    : m.invitedAt
                      ? ` · invited ${new Date(m.invitedAt).toLocaleDateString()}`
                      : null}
                </span>
              </div>
              {isAdmin ? (
                <div className="team-member-actions">
                  <label className="team-inline-role">
                    <span className="visually-hidden">Role</span>
                    <select
                      value={m.role}
                      aria-label={`Role for ${m.email}`}
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
                  </label>
                  <button
                    type="button"
                    className="btn-secondary team-remove-btn"
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
                </div>
              ) : (
                <span className={`team-role-badge ${m.role}`}>{roleLabel(m.role)}</span>
              )}
            </li>
          ))}
        </ul>
        {team && team.members.length === 0 && (
          <p className="team-empty-hint">No invited members yet{isAdmin ? " — send an invite above." : "."}</p>
        )}
      </section>
    </div>
  );
}
