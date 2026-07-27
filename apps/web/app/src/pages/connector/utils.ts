import type { CloudProvider } from "../../lib/api";
import { DRAFT_URL, PROVIDERS, TEST_OK_STORAGE_KEY } from "./constants";
import type { ProviderTestState, ProviderTests } from "./types";

export function emptyTests(): ProviderTests {
  return {
    dropbox: { status: "idle", message: null, hint: null, at: null },
    onedrive: { status: "idle", message: null, hint: null, at: null },
    box: { status: "idle", message: null, hint: null, at: null },
  };
}

export function loadPersistedTests(): ProviderTests {
  try {
    const raw = localStorage.getItem(TEST_OK_STORAGE_KEY);
    if (!raw) return emptyTests();
    const parsed = JSON.parse(raw) as Partial<Record<CloudProvider, ProviderTestState>>;
    const next = emptyTests();
    for (const p of PROVIDERS) {
      if (parsed[p]?.status === "ok") {
        next[p] = {
          status: "ok",
          message: parsed[p]?.message ?? "OK (restored)",
          hint: null,
          at: parsed[p]?.at ?? null,
        };
      }
    }
    return next;
  } catch {
    return emptyTests();
  }
}

export function persistTests(tests: ProviderTests) {
  const toSave: Partial<Record<CloudProvider, ProviderTestState>> = {};
  for (const p of PROVIDERS) {
    if (tests[p].status === "ok") toSave[p] = tests[p];
  }
  if (Object.keys(toSave).length === 0) {
    localStorage.removeItem(TEST_OK_STORAGE_KEY);
  } else {
    localStorage.setItem(TEST_OK_STORAGE_KEY, JSON.stringify(toSave));
  }
}

export function sampleCurl(token: string): string {
  // Single pasteable line — avoids users running the bare key as a shell command.
  return `curl -sS -X POST '${DRAFT_URL}' -H 'Authorization: Bearer ${token}' -H 'Content-Type: application/json' -d '{"client_name":"Acme LLC","invoice_amount":1250,"days_overdue":14}'`;
}

export function sampleCurlDisplay(token: string): string {
  return `curl -sS -X POST '${DRAFT_URL}' \\
  -H 'Authorization: Bearer ${token}' \\
  -H 'Content-Type: application/json' \\
  -d '{"client_name":"Acme LLC","invoice_amount":1250,"days_overdue":14}'`;
}
