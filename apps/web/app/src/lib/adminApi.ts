import { isExcludeSelf, setExcludeSelf, track } from "./analytics";

export type FunnelStats = {
  days: number;
  since: string;
  humansOnly: boolean;
  totals: {
    accounts: number;
    paidAccounts: number;
    events: number;
    activationKpi: number;
    completionKpi: number;
  };
  activation: { name: string; count: number }[];
  completion: { name: string; count: number }[];
  template: { name: string; count: number }[];
  traffic: { name: string; count: number }[];
  email: { name: string; count: number }[];
  errors: { name: string; count: number }[];
};

export type TrafficStats = {
  days: number;
  pageViews: number;
  botPct: number;
  chasesSent: number;
  chasesCompleted: number;
  conversion: string;
  byDay: { day: string; human: number; bot: number }[];
  byRoute: { path: string; total: number; human: number; bot: number }[];
  byBot: { bot: string; count: number }[];
  byCountry: { country: string; count: number }[];
  note: string;
};

export type SignupLists = {
  total: number;
  free: { email: string; plan: string; createdAt: string }[];
  paid: { email: string; plan: string; createdAt: string }[];
  enterprise: { email: string; plan: string; createdAt: string }[];
};

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  description: string;
  body: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/admin${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export function adminLogin(email: string, password: string, turnstileToken?: string | null) {
  return adminFetch<{ ok: true; email: string }>("/login", {
    method: "POST",
    body: JSON.stringify({ email, password, turnstileToken: turnstileToken || undefined }),
  });
}

export function adminLogout() {
  return adminFetch<{ ok: true }>("/logout", { method: "POST" });
}

export function adminMe() {
  return adminFetch<{ email: string }>("/me");
}

/** `humansOnly` drops classified crawlers from the event counts — see getFunnelStats in the worker
 *  for why a funnel read across both audiences at once is misleading. */
export function adminFunnels(days = 30, humansOnly = false) {
  return adminFetch<FunnelStats>(`/funnels?days=${days}${humansOnly ? "&humansOnly=1" : ""}`);
}

export function adminTraffic(days = 30) {
  return adminFetch<TrafficStats>(`/traffic?days=${days}`);
}

export function adminSignups() {
  return adminFetch<SignupLists>("/signups");
}

export function adminGrantEnterprise(email: string) {
  return adminFetch<{ ok: true; email: string; plan: string }>("/grant-enterprise", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function adminBlogList() {
  return adminFetch<{ posts: BlogPost[] }>("/blog");
}

export function adminBlogCreate(input: {
  title: string;
  slug?: string;
  description?: string;
  body: string;
  published?: boolean;
}) {
  return adminFetch<{ post: BlogPost }>("/blog", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function adminBlogUpdate(
  id: string,
  input: Partial<{ title: string; slug: string; description: string; body: string; published: boolean }>
) {
  return adminFetch<{ post: BlogPost }>(`/blog/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function adminBlogDelete(id: string) {
  return adminFetch<{ ok: true }>(`/blog/${id}`, { method: "DELETE" });
}

export { track, isExcludeSelf, setExcludeSelf };
