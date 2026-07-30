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
import { useT } from "../lib/i18n";

function emailInitials(email: string): string {
  const local = email.split("@")[0]?.trim() || "?";
  const parts = local.split(/[._\-+]/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

function roleLabel(role: string, t: (key: string) => string): string {
  if (role === "admin") return t("team.admin");
  if (role === "owner") return t("team.owner");
  return t("team.member");
}

export default function TeamPage({
  account,
  refresh,
}: {
  account: Account | null;
  refresh: () => Promise<void>;
}) {
  const t = useT();
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
  const seatsUnlimited = seatsLimit >= 1000;
  const seatsPct = seatsUnlimited
    ? 0
    : seatsLimit > 0
      ? Math.min(100, Math.round((seatsUsed / seatsLimit) * 100))
      : 0;

  async function load() {
    const t = await getTeam();
    setTeam(t);
  }

  useEffect(() => {
    if (!account || !isPaid) return;
    load().catch((err) => setError(err instanceof Error ? err.message : t("team.loadFailed")));
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
      .catch((err) => setError(err instanceof Error ? err.message : t("team.acceptFailed")))
      .finally(() => setBusy(false));
  }, [account, isPaid, searchParams, accepted]);

  if (!account) {
    return (
      <div className="team-page">
        <p className="crumb">
          <Link to="/account">{t("team.crumbAccount")}</Link> / {t("team.title")}
        </p>
        <h1>{t("team.title")}</h1>
        <p className="page-sub">{t("team.signInSub")}</p>
        <Link className="btn-primary" to="/login">
          {t("nav.signin")}
        </Link>
      </div>
    );
  }

  if (!isPaid) {
    return (
      <div className="team-page">
        <p className="crumb">
          <Link to="/account">{t("team.crumbAccount")}</Link> / {t("team.title")}
        </p>
        <h1>{t("team.title")}</h1>
        <p className="page-sub">{t("team.upgradeSub")}</p>
        <div className="upgrade-nudge">
          <Link to="/account">{t("team.upgradeToSolo")}</Link> {t("team.upgradeSeatsHint")}
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
      setError(err instanceof Error ? err.message : t("team.inviteFailed"));
    } finally {
      setBusy(false);
    }
  }

  const yourRole = team?.yourRole ?? account.role ?? "admin";
  const isAdmin = yourRole === "admin";

  return (
    <div className="team-page">
      <p className="crumb">
        <Link to="/account">{t("team.crumbAccount")}</Link> / {t("team.title")}
      </p>
      <h1>{t("team.title")}</h1>
      <p className="page-sub">
        {t("team.signedInAs")}{" "}
        <strong>{account.email}</strong> · {t("team.roleWord")}{" "}
        <span className={`team-role-badge ${yourRole}`}>{roleLabel(yourRole, t)}</span>
      </p>

      {accepted && <div className="success-msg">{t("team.inviteAccepted")}</div>}
      {error && <div className="error-msg">{error}</div>}

      <section className="branding-card team-seats-card">
        <div className="team-seats-head">
          <div>
            <h2>{t("team.seats")}</h2>
            <p className="branding-help">
              {seatsLimit > 0 ? (
                seatsUnlimited ? (
                  <>
                    {t("team.seatsUsedUnlimited", { used: seatsUsed })}
                    {team?.ownerEmail ? (
                      <>
                        {" "}
                        {t("team.ownerSuffix")} <strong>{team.ownerEmail}</strong>
                      </>
                    ) : null}
                  </>
                ) : (
                  <>
                    {t("team.seatsUsedOf", { used: seatsUsed, limit: seatsLimit })}
                    {team?.ownerEmail ? (
                      <>
                        {" "}
                        {t("team.ownerSuffix")} <strong>{team.ownerEmail}</strong>
                      </>
                    ) : null}
                  </>
                )
              ) : (
                t("team.seatsLoading")
              )}
            </p>
          </div>
          <span className="team-seats-count">
            {seatsUnlimited ? `${seatsUsed} / ∞` : `${seatsUsed}/${seatsLimit || "—"}`}
          </span>
        </div>
        <div
          className="team-seats-track"
          role="progressbar"
          aria-valuenow={seatsUsed}
          aria-valuemin={0}
          aria-valuemax={seatsUnlimited ? Math.max(seatsUsed, 1) : seatsLimit || 1}
          aria-label={t("team.seatUsageAria")}
        >
          <div className="team-seats-fill" style={{ width: `${seatsPct}%` }} />
        </div>
      </section>

      {isAdmin && (
        <section className="branding-card">
          <h2>{t("team.inviteTitle")}</h2>
          <p className="branding-help">{t("team.inviteHelp")}</p>
          <form className="team-invite-form" onSubmit={handleInvite}>
            <label className="team-invite-email">
              {t("team.email")}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("team.emailPlaceholder")}
                required
                disabled={busy}
                autoComplete="email"
              />
            </label>
            <label className="team-invite-role">
              {t("team.role")}
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "admin" | "member")}
                disabled={busy}
              >
                <option value="member">{t("team.member")}</option>
                <option value="admin">{t("team.admin")}</option>
              </select>
            </label>
            <button
              className="btn-primary team-invite-submit"
              type="submit"
              disabled={busy || (team?.seats.remaining ?? 0) <= 0}
            >
              {busy ? t("team.sending") : t("team.sendInvite")}
            </button>
          </form>
          {inviteUrl && (
            <p className="team-invite-link">
              {t("team.inviteSent")} <code>{inviteUrl}</code>
            </p>
          )}
          {(team?.seats.remaining ?? 0) <= 0 && (
            <p className="team-invite-full">{t("team.seatsFull")}</p>
          )}
        </section>
      )}

      <section className="branding-card">
        <h2>{t("team.members")}</h2>
        <p className="branding-help">{t("team.membersHelp")}</p>
        <ul className="team-list">
          <li className="team-member-row">
            <span className="team-avatar" aria-hidden>
              {emailInitials(team?.ownerEmail ?? account.email)}
            </span>
            <div className="team-member-main">
              <strong>{team?.ownerEmail ?? "…"}</strong>
              <span className="team-member-meta">{t("team.workspaceOwner")}</span>
            </div>
            <span className="team-role-badge admin">{t("team.owner")}</span>
          </li>
          {(team?.members ?? []).map((m) => (
            <li key={m.id} className="team-member-row">
              <span className="team-avatar" aria-hidden>
                {emailInitials(m.email)}
              </span>
              <div className="team-member-main">
                <strong>{m.email}</strong>
                <span className="team-member-meta">
                  {m.status === "pending" ? t("team.pending") : t("team.active")}
                  {m.joinedAt
                    ? t("team.joined", { date: new Date(m.joinedAt).toLocaleDateString() })
                    : m.invitedAt
                      ? t("team.invited", { date: new Date(m.invitedAt).toLocaleDateString() })
                      : null}
                </span>
              </div>
              {isAdmin ? (
                <div className="team-member-actions">
                  <label className="team-inline-role">
                    <span className="visually-hidden">{t("team.role")}</span>
                    <select
                      value={m.role}
                      aria-label={`${t("team.role")} ${m.email}`}
                      onChange={async (e) => {
                        try {
                          await updateTeamMemberRole(m.id, e.target.value as "admin" | "member");
                          await load();
                        } catch (err) {
                          setError(err instanceof Error ? err.message : t("team.updateFailed"));
                        }
                      }}
                    >
                      <option value="member">{t("team.member")}</option>
                      <option value="admin">{t("team.admin")}</option>
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
                        setError(err instanceof Error ? err.message : t("team.removeFailed"));
                      }
                    }}
                  >
                    {t("team.remove")}
                  </button>
                </div>
              ) : (
                <span className={`team-role-badge ${m.role}`}>{roleLabel(m.role, t)}</span>
              )}
            </li>
          ))}
        </ul>
        {team && team.members.length === 0 && (
          <p className="team-empty-hint">
            {t("team.noMembersHint")}
            {isAdmin ? t("team.noMembersAdminSuffix") : "."}
          </p>
        )}
      </section>
    </div>
  );
}
