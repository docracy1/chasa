import type { Env } from "../types";
import { sendSpaSmokeAlert } from "./email";

const PROBE_UA =
  "Mozilla/5.0 (compatible; ChasaSpaSmoke/1.0; +https://chasa.io) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36";

const REMIND_AFTER_MS = 6 * 60 * 60 * 1000;
const STATE_KEY = "spa-smoke";

/** Sign in + Start free (app shell). Marketing homepage is static HTML — not this failure mode. */
const CRITICAL_PATHS = ["/app/", "/app/login"] as const;

export interface SpaSmokeFailure {
  name: string;
  detail: string;
}

interface AlertState {
  failing: boolean;
  lastAlertAt: number;
  fingerprint: string;
}

function appOrigin(env: Env): string {
  const configured = (env.PUBLIC_APP_URL || "").replace(/\/$/, "");
  // Smoke must hit the user-facing host, not a stale pages.dev PUBLIC_APP_URL.
  if (configured.includes("chasa.io") && !configured.includes("pages.dev")) return configured;
  return "https://chasa.io";
}

function workerOrigin(env: Env): string {
  return (env.PUBLIC_WORKER_URL || "https://api.chasa.io").replace(/\/$/, "");
}

export function extractMainModuleSrc(html: string): string | null {
  const re =
    /<script[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+\.js[^"']*)["'][^>]*>|<script[^>]*\bsrc=["']([^"']+\.js[^"']*)["'][^>]*\btype=["']module["'][^>]*>/i;
  const m = html.match(re);
  return m?.[1] ?? m?.[2] ?? null;
}

export function isJavascriptContentType(ct: string | null): boolean {
  if (!ct) return false;
  const lower = ct.toLowerCase();
  return lower.includes("javascript") || lower.includes("ecmascript") || lower.startsWith("text/js");
}

export function looksLikeHtmlFallback(body: string): boolean {
  const head = body.slice(0, 256).trimStart().toLowerCase();
  return head.startsWith("<!doctype") || head.startsWith("<html") || head.startsWith("<head");
}

function absUrl(base: string, src: string): string {
  try {
    return new URL(src, base).toString();
  } catch {
    return src;
  }
}

async function fetchText(url: string): Promise<{
  ok: boolean;
  status: number;
  contentType: string | null;
  body: string;
}> {
  const res = await fetch(url, {
    headers: { "User-Agent": PROBE_UA, Accept: "*/*" },
    redirect: "follow",
  });
  return {
    ok: res.ok,
    status: res.status,
    contentType: res.headers.get("content-type"),
    body: await res.text(),
  };
}

export async function checkSpaPage(pageUrl: string): Promise<SpaSmokeFailure | null> {
  let page;
  try {
    page = await fetchText(pageUrl);
  } catch (err) {
    return { name: pageUrl, detail: `fetch failed: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (!page.ok) return { name: pageUrl, detail: `HTTP ${page.status}` };
  if (!page.contentType?.toLowerCase().includes("text/html")) {
    return { name: pageUrl, detail: `expected text/html, got ${page.contentType ?? "(none)"}` };
  }

  const src = extractMainModuleSrc(page.body);
  if (!src) return { name: pageUrl, detail: "no <script type=module src=*.js> in HTML" };

  const assetUrl = absUrl(pageUrl, src);
  let asset;
  try {
    asset = await fetchText(assetUrl);
  } catch (err) {
    return {
      name: `${pageUrl} → ${src}`,
      detail: `asset fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  if (!asset.ok) return { name: `${pageUrl} → ${src}`, detail: `asset HTTP ${asset.status}` };
  if (!isJavascriptContentType(asset.contentType)) {
    return {
      name: `${pageUrl} → ${src}`,
      detail: `asset Content-Type is ${asset.contentType ?? "(none)"} (expected javascript) — likely SPA HTML fallback`,
    };
  }
  if (looksLikeHtmlFallback(asset.body)) {
    return {
      name: `${pageUrl} → ${src}`,
      detail: "asset body looks like HTML (SPA fallback) instead of JavaScript",
    };
  }
  return null;
}

async function checkAuthConfig(env: Env): Promise<SpaSmokeFailure | null> {
  const url = `${workerOrigin(env)}/api/auth/config`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": PROBE_UA, Accept: "application/json" },
    });
    const ct = res.headers.get("content-type") ?? "";
    if (!res.ok) return { name: "API auth/config", detail: `HTTP ${res.status}` };
    if (!ct.toLowerCase().includes("application/json")) {
      return { name: "API auth/config", detail: `expected JSON, got ${ct || "(none)"}` };
    }
    const body = (await res.json()) as { turnstileSiteKey?: unknown };
    if (typeof body.turnstileSiteKey !== "string") {
      return { name: "API auth/config", detail: "missing turnstileSiteKey" };
    }
    return null;
  } catch (err) {
    return {
      name: "API auth/config",
      detail: `fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function runSpaSmokeChecks(env: Env): Promise<SpaSmokeFailure[]> {
  const base = appOrigin(env);
  const pageResults = await Promise.all(CRITICAL_PATHS.map((p) => checkSpaPage(`${base}${p}`)));
  const failures = pageResults.filter((f): f is SpaSmokeFailure => f !== null);
  const apiFail = await checkAuthConfig(env);
  if (apiFail) failures.push(apiFail);
  return failures;
}

function fingerprint(failures: SpaSmokeFailure[]): string {
  return failures
    .map((f) => `${f.name}|${f.detail}`)
    .sort()
    .join("\n");
}

async function ensureStateTable(env: Env): Promise<void> {
  await env.CHASA_DB.prepare(
    `CREATE TABLE IF NOT EXISTS smoke_alert_state (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  ).run();
}

async function readState(env: Env): Promise<AlertState | null> {
  await ensureStateTable(env);
  const row = await env.CHASA_DB.prepare(`SELECT value FROM smoke_alert_state WHERE key = ?`)
    .bind(STATE_KEY)
    .first<{ value: string }>();
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value) as AlertState;
  } catch {
    return null;
  }
}

async function writeState(env: Env, state: AlertState | null): Promise<void> {
  await ensureStateTable(env);
  if (!state) {
    await env.CHASA_DB.prepare(`DELETE FROM smoke_alert_state WHERE key = ?`).bind(STATE_KEY).run();
    return;
  }
  await env.CHASA_DB.prepare(
    `INSERT INTO smoke_alert_state (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  )
    .bind(STATE_KEY, JSON.stringify(state), new Date().toISOString())
    .run();
}

/**
 * Hourly SPA smoke for Sign in (/app/login) + Start free (/app/).
 * Alerts FEEDBACK_EMAIL (founder@chasa.io) on transition to failing, then every 6h while down.
 */
export async function runSpaSmokeAndAlert(env: Env): Promise<void> {
  const failures = await runSpaSmokeChecks(env);
  const prev = await readState(env);
  const now = Date.now();

  if (failures.length === 0) {
    if (prev?.failing) console.log("[spa-smoke] recovered after previous failure");
    await writeState(env, null);
    return;
  }

  const fp = fingerprint(failures);
  const shouldAlert =
    !prev?.failing || prev.fingerprint !== fp || now - (prev.lastAlertAt ?? 0) >= REMIND_AFTER_MS;

  if (shouldAlert) {
    const to = env.FEEDBACK_EMAIL || "founder@chasa.io";
    await sendSpaSmokeAlert(env, to, failures);
    await writeState(env, { failing: true, lastAlertAt: now, fingerprint: fp });
    console.error(`[spa-smoke] alerted ${to}: ${failures.map((f) => f.name).join(", ")}`);
  } else {
    console.error(`[spa-smoke] still failing (suppressed): ${failures.map((f) => f.name).join(", ")}`);
  }
}
