import type { CloudProvider } from "../../lib/api";

export type ProviderTestState = {
  status: "idle" | "running" | "ok" | "fail";
  message: string | null;
  hint: string | null;
  at: string | null;
};

export type ProviderTests = Record<CloudProvider, ProviderTestState>;
