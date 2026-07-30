import { useEffect } from "react";
import { Link } from "react-router-dom";
import { FREE_LIMIT } from "../../../lib/usage";
import { track } from "../../../lib/analytics";
import { useT } from "../../../lib/i18n";

interface UsageBarProps {
  usedCount: number;
  atLimit: boolean;
  isPaid: boolean;
  /** Anonymous visitors get a second, free path out of the wall — signing in costs nothing and
   *  makes them reachable, where an anonymous visitor who leaves at the cap never returns. */
  isSignedIn: boolean;
}

export function UsageBar({ usedCount, atLimit, isPaid, isSignedIn }: UsageBarProps) {
  const t = useT();
  useEffect(() => {
    if (atLimit) track("quota_wall_shown", { signedIn: isSignedIn });
  }, [atLimit, isSignedIn]);

  if (isPaid) return null;

  const remaining = Math.max(0, FREE_LIMIT - usedCount);

  if (!atLimit) {
    return (
      <div className="usage-bar">
        {t("usage.bar", { used: usedCount, limit: FREE_LIMIT })}
        {remaining === 1 && <strong className="usage-bar-last">{t("usage.lastOne")}</strong>}
      </div>
    );
  }

  return (
    <div className="quota-wall">
      <h3 className="quota-wall-title">{t("usage.wallTitle", { limit: FREE_LIMIT })}</h3>
      <p className="quota-wall-body">{t("usage.wallBody")}</p>
      <div className="quota-wall-actions">
        <Link
          to="/account"
          className="quota-wall-primary"
          onClick={() => track("quota_wall_upgrade_clicked", { signedIn: isSignedIn })}
        >
          {t("usage.upgradeSolo")}
        </Link>
        {!isSignedIn && (
          <Link
            to="/login"
            className="quota-wall-secondary"
            onClick={() => track("quota_wall_signin_clicked")}
          >
            {t("usage.orSignIn")}
          </Link>
        )}
      </div>
      <p className="quota-wall-note">{t("usage.resetNote")}</p>
    </div>
  );
}
