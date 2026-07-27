import type { Env } from "../types";

export function isProductionHttps(env: Env): boolean {
  const url = env.PUBLIC_APP_URL?.trim() || "";
  return url.startsWith("https://") && !url.includes("localhost");
}

export function isLocalDev(env: Env): boolean {
  const url = env.PUBLIC_APP_URL?.trim() || "";
  return url.startsWith("http://localhost:") || url.startsWith("http://127.0.0.1:");
}
