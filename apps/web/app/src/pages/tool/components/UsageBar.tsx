import { useEffect } from "react";
import { Link } from "react-router-dom";
import { FREE_LIMIT } from "../../../lib/usage";
import { track } from "../../../lib/analytics";

interface UsageBarProps {
  usedCount: number;
  atLimit: boolean;
  isPaid: boolean;
  /** Anonymous visitors get a second, free path out of the wall — signing in costs nothing and
   *  makes them reachable, where an anonymous visitor who leaves at the cap never returns. */
  isSignedIn: boolean;
}

export function UsageBar({ usedCount, atLimit, isPaid, isSignedIn }: UsageBarProps) {
  useEffect(() => {
    if (atLimit) track("quota_wall_shown", { signedIn: isSignedIn });
  }, [atLimit, isSignedIn]);

  if (isPaid) return null;

  const remaining = Math.max(0, FREE_LIMIT - usedCount);

  if (!atLimit) {
    return (
      <div className="usage-bar">
        {usedCount}/{FREE_LIMIT} free drafts used this month
        {remaining === 1 && <strong className="usage-bar-last"> · last free one</strong>}
      </div>
    );
  }

  return (
    <div className="quota-wall">
      <h3 className="quota-wall-title">
        You've written {FREE_LIMIT} chase emails this month
      </h3>
      <p className="quota-wall-body">
        That's the free monthly cap. Solo lifts it entirely — unlimited drafts, plus soften and
        firm-up rewrites, chase plans with calendar dates, and saved clients.
      </p>
      <div className="quota-wall-actions">
        <Link
          to="/account"
          className="quota-wall-primary"
          onClick={() => track("quota_wall_upgrade_clicked", { signedIn: isSignedIn })}
        >
          Upgrade to Solo — $7/mo
        </Link>
        {!isSignedIn && (
          <Link
            to="/login"
            className="quota-wall-secondary"
            onClick={() => track("quota_wall_signin_clicked")}
          >
            or sign in free to keep your drafts
          </Link>
        )}
      </div>
      <p className="quota-wall-note">
        Free drafts reset on the 1st. Your invoices stay on this device either way.
      </p>
    </div>
  );
}
