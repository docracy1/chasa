import { useCallback, useEffect, useState } from "react";
import { getMe, type Account } from "./api";

export function useAccount() {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const acc = await getMe();
    setAccount(acc);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { account, loading, refresh };
}
