export interface Env {
  CHASA_DB: D1Database;
  AI: Ai;

  // Secrets (wrangler secret put ...)
  TOKEN_SECRET: string;
  RESEND_API_KEY?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  // Cloud storage OAuth (Dropbox / OneDrive / Box) — see routes/cloudConnectors.ts
  DROPBOX_CLIENT_ID?: string;
  DROPBOX_CLIENT_SECRET?: string;
  ONEDRIVE_CLIENT_ID?: string;
  ONEDRIVE_CLIENT_SECRET?: string;
  BOX_CLIENT_ID?: string;
  BOX_CLIENT_SECRET?: string;

  // Non-secret config ([vars] in wrangler.toml)
  WORKERS_AI_MODEL?: string;
  PUBLIC_APP_URL: string;
  PUBLIC_WORKER_URL: string;
  /** @deprecated Use STRIPE_PRICE_SOLO / PRO / ENTERPRISE */
  STRIPE_PRICE_ID?: string;
  STRIPE_PRICE_SOLO?: string;
  STRIPE_PRICE_PRO?: string;
  STRIPE_PRICE_ENTERPRISE?: string;
  FEEDBACK_EMAIL?: string;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
}
