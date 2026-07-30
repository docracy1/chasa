import { Navigate, useLocation } from "react-router-dom";
import { useAccountContext } from "../lib/AccountContext";
import { useT } from "../lib/i18n";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const t = useT();
  const { account, loading } = useAccountContext();
  const location = useLocation();

  if (loading) {
    return (
      <div className="wrap" style={{ padding: "48px 0" }}>
        <p className="page-sub">{t("common.loading")}</p>
      </div>
    );
  }

  if (!account) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
