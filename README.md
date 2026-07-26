# Chasa

Paste your unpaid invoices. Get the follow-up email already written, in the right tone for how late it is.

## Structure

- `apps/web` — React (Vite) app deployed to Cloudflare Pages. `public/index.html` is the static marketing landing page; `app/` is the actual tool (`/app/*`).
- `apps/worker` — Cloudflare Worker (Hono) backend, deployed separately as `api.chasa.io`. Auth (magic link + session), Stripe billing, and Workers AI email drafting all live here.

## Local development

```bash
npm install
npm run dev:worker   # wrangler dev --local, http://127.0.0.1:8787
npm run dev:web      # vite, http://localhost:5173 (proxies /api to the worker)
```

Without `RESEND_API_KEY` set, magic links are logged to the worker's console instead of emailed — copy the printed URL into your browser to log in during local dev.

## One-time cloud setup (do this yourself — touches your real accounts)

1. `cd apps/worker && wrangler d1 create chasa-db` (and `chasa-db-staging` if you want an isolated staging env) — paste the returned `database_id` into `wrangler.toml`.
2. `wrangler d1 migrations apply chasa-db --local` for dev, `--remote` once you're ready to deploy for real.
3. In the Stripe Dashboard, **test mode** first: create a Product with a $9/mo recurring Price. Copy the `price_...` id into `wrangler.toml`'s `[vars]` as `STRIPE_PRICE_ID` (not a secret).
4. `wrangler secret put TOKEN_SECRET` — generate one with `openssl rand -hex 32`.
5. `wrangler secret put STRIPE_SECRET_KEY` (test key first).
6. Stripe Dashboard → Developers → Webhooks → add endpoint `https://api.chasa.io/api/billing/webhook`, subscribed to `checkout.session.completed` and `customer.subscription.deleted` → `wrangler secret put STRIPE_WEBHOOK_SECRET` with the signing secret shown.
7. `wrangler secret put RESEND_API_KEY` — verify `chasa.io` as a sending domain in Resend.
8. (Optional) Cloud storage connectors — Dropbox / OneDrive / Box PDF import (Solo+).

   Create an app in each provider console and register these **exact** redirect URIs:

   | Provider | Console | Redirect URI |
   |---|---|---|
   | Dropbox | [App Console](https://www.dropbox.com/developers/apps) | `https://api.chasa.io/api/account/connectors/dropbox/callback` |
   | OneDrive | [Microsoft Entra app registration](https://entra.microsoft.com/) (delegated `User.Read`, `Files.Read`, `offline_access`) | `https://api.chasa.io/api/account/connectors/onedrive/callback` |
   | Box | [Box Developer Console](https://developer.box.com/) | `https://api.chasa.io/api/account/connectors/box/callback` |

   Then set secrets from `apps/worker` (do **not** commit values):

   ```bash
   wrangler secret put DROPBOX_CLIENT_ID
   wrangler secret put DROPBOX_CLIENT_SECRET
   wrangler secret put ONEDRIVE_CLIENT_ID
   wrangler secret put ONEDRIVE_CLIENT_SECRET
   wrangler secret put BOX_CLIENT_ID
   wrangler secret put BOX_CLIENT_SECRET
   ```

   Until a provider’s pair is set, its Connect button stays disabled and `/connect` returns **503**.
   OAuth tokens are AES-GCM encrypted at rest with `TOKEN_SECRET`. After connect, paid users can
   list recent PDFs and **Import to Tool** — the worker downloads the file, scrapes text hints
   (client / amount / due), and never returns raw tokens or PDF bytes to the browser.
9. Create the Cloudflare Pages project (`wrangler pages deploy dist --project-name=chasa` from `apps/web` after building) and attach `chasa.io` as its custom domain; attach `api.chasa.io` as the Worker's custom domain — both via the Cloudflare dashboard.
10. Only switch to Stripe **live mode** keys/price/webhook once you've smoke-tested the whole flow in test mode.

AI email drafting uses **Cloudflare Workers AI** (free tier: 10,000 neurons/day) — no Anthropic or OpenAI key needed.

### Local secrets for `wrangler dev`

Create `apps/worker/.dev.vars` (gitignored) with test-mode values, e.g.:

```
TOKEN_SECRET=dev-secret-not-for-prod
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

To test the Stripe flow locally, forward webhooks with the Stripe CLI:

```bash
stripe listen --forward-to localhost:8787/api/billing/webhook
```
