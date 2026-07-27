import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getMe, logout as apiLogout, type Account } from "./api";

type AccountContextValue = {
  account: Account | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const acc = await getMe();
    setAccount(acc);
    setLoading(false);
  }, []);

  const signOut = useCallback(async () => {
    await apiLogout().catch(() => {});
    setAccount(null);
    window.location.href = "/app/login";
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <AccountContext.Provider value={{ account, loading, refresh, signOut }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccountContext(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccountContext must be used within AccountProvider");
  return ctx;
}
