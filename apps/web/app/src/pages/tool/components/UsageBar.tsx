import { Link } from "react-router-dom";
import { FREE_LIMIT } from "../../../lib/usage";

interface UsageBarProps {
  usedCount: number;
  atLimit: boolean;
  isPaid: boolean;
}

export function UsageBar({ usedCount, atLimit, isPaid }: UsageBarProps) {
  return (
    <>
      {!isPaid && (
        <div className="usage-bar">
          {usedCount}/{FREE_LIMIT} free drafts used this month
        </div>
      )}

      {atLimit && (
        <div className="upgrade-nudge">
          You've used your 5 free drafts this month.{" "}
          <Link to="/account">Upgrade to Chasa Paid</Link> for unlimited invoices.
        </div>
      )}
    </>
  );
}
