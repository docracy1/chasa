import type { Account } from "./api";

/** Workspace admin (owner / admin seat). Missing role = solo owner (legacy). */
export function isWorkspaceAdmin(account: Account | null | undefined): boolean {
  if (!account) return false;
  return account.role !== "member";
}

export function isPaidPlan(account: Account | null | undefined): boolean {
  return !!account && account.plan !== "free" && account.plan != null;
}

export function isProPlan(account: Account | null | undefined): boolean {
  return account?.plan === "pro" || account?.plan === "enterprise";
}
