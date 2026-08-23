export interface Env {
  CHASA_DB: D1Database;
  AI: Ai;

  // Secrets (wrangler secret put ...)
  TOKEN_SECRET: string;
  RESEND_API_KEY?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  /** Cloudflare Turnstile secret — required in production when bot protection is enabled */
  TURNSTILE_SECRET_KEY?: string;
  // Cloud storage OAuth (Dropbox / OneDrive / Box) — see routes/cloudConnectors.ts
  DROPBOX_CLIENT_ID?: string;
  DROPBOX_CLIENT_SECRET?: string;
  ONEDRIVE_CLIENT_ID?: string;
  ONEDRIVE_CLIENT_SECRET?: string;
  BOX_CLIENT_ID?: string;
  BOX_CLIENT_SECRET?: string;
  /** Google Sign-In OAuth — see lib/auth.ts */
  GOOGLE_LOGIN_CLIENT_ID?: string;
  GOOGLE_LOGIN_CLIENT_SECRET?: string;
  /** Google Drive / Gmail / Calendar / Sheets connector — see lib/cloudConnectors.ts */
  GOOGLE_INTEGRATIONS_CLIENT_ID?: string;
  GOOGLE_INTEGRATIONS_CLIENT_SECRET?: string;
  // Native accounting OAuth (QuickBooks Online / Xero) — see routes/accountingConnectors.ts
  QBO_CLIENT_ID?: string;
  QBO_CLIENT_SECRET?: string;
  XERO_CLIENT_ID?: string;
  XERO_CLIENT_SECRET?: string;
  /** Microsoft Clarity Data Export API token (project-scoped) — see lib/clarityApi.ts */
  CLARITY_API_TOKEN?: string;
  /** Cloudflare API token, "Zone > Analytics > Read" scoped to the chasa.io zone only —
   *  see lib/cloudflareAnalytics.ts */
  CF_ANALYTICS_TOKEN?: string;
  /** ACME v2 directory URL — defaults to Let's Encrypt staging in lib/acme.ts if unset. Set to
   *  the production directory only once the flow has been validated end-to-end. */
  ACME_DIRECTORY_URL?: string;
  /** URL of the small external relay (apps/acme-relay) that forwards ACME requests to Let's
   *  Encrypt — required because Cloudflare Workers cannot reach Let's Encrypt's API directly
   *  (see lib/acme.ts's module comment). */
  ACME_RELAY_URL?: string;
  /** Shared bearer secret for the ACME relay — must match the relay's own RELAY_SECRET env var. */
  ACME_RELAY_SECRET?: string;

  // Non-secret config ([vars] in wrangler.toml)
  WORKERS_AI_MODEL?: string;
  PUBLIC_APP_URL: string;
  PUBLIC_WORKER_URL: string;
  /** Cloudflare Turnstile site key (public) — exposed to the login UI via /api/auth/config */
  TURNSTILE_SITE_KEY?: string;
  /** @deprecated Use STRIPE_PRICE_SOLO / PRO / ENTERPRISE */
  STRIPE_PRICE_ID?: string;
  STRIPE_PRICE_SOLO?: string;
  STRIPE_PRICE_PRO?: string;
  STRIPE_PRICE_ENTERPRISE?: string;
  FEEDBACK_EMAIL?: string;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
}
