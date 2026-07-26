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

### Cloudflare Turnstile (bot protection on magic-link login)

Protects `/api/auth/request` (and admin login) so bots can't burn Resend quota requesting hundreds of magic links. Customer login stays magic-link only — no passwords.

1. In the [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Turnstile** → **Add widget**.
2. Set hostname(s) to `chasa.io` (and `localhost` if you want to test the real widget locally).
3. Copy the **site key** into `apps/worker/wrangler.toml` `[vars]`:

   ```toml
   TURNSTILE_SITE_KEY = "0x4AAAAAAA..."   # public; safe in [vars]
   ```

4. Set the **secret key** (never commit it):

   ```bash
   cd apps/worker
   wrangler secret put TURNSTILE_SECRET_KEY
   ```

5. Redeploy the worker after setting vars/secrets. The web app reads the site key from `GET /api/auth/config` — no separate Pages env var needed.

**Local / without keys:** If `TURNSTILE_SECRET_KEY` is unset, verification is bypassed with a clear console warning so local login still works. Optionally use Cloudflare's always-pass test keys in `.dev.vars` / `[vars]`:

| | Test value |
|---|---|
| Site key | `1x00000000000000000000AA` |
| Secret key | `1x0000000000000000000000000000000AA` |

When the secret **is** set (production), a valid Turnstile token is required. There is also a soft 60s per-email cooldown on magic-link requests.

## One-time cloud setup (do this yourself — touches your real accounts)

1. `cd apps/worker && wrangler d1 create chasa-db` (and `chasa-db-staging` if you want an isolated staging env) — paste the returned `database_id` into `wrangler.toml`.
2. `wrangler d1 migrations apply chasa-db --local` for dev, `--remote` once you're ready to deploy for real.
3. In the Stripe Dashboard, **test mode** first: create a Product with a $9/mo recurring Price. Copy the `price_...` id into `wrangler.toml`'s `[vars]` as `STRIPE_PRICE_ID` (not a secret).
4. `wrangler secret put TOKEN_SECRET` — generate one with `openssl rand -hex 32`.
5. `wrangler secret put STRIPE_SECRET_KEY` (test key first).
6. Stripe Dashboard → Developers → Webhooks → add endpoint `https://api.chasa.io/api/billing/webhook`, subscribed to `checkout.session.completed` and `customer.subscription.deleted` → `wrangler secret put STRIPE_WEBHOOK_SECRET` with the signing secret shown.
7. `wrangler secret put RESEND_API_KEY` — verify `chasa.io` as a sending domain in Resend.
8. Cloudflare Turnstile — see [Turnstile section above](#cloudflare-turnstile-bot-protection-on-magic-link-login): add widget, set `TURNSTILE_SITE_KEY` in `[vars]`, `wrangler secret put TURNSTILE_SECRET_KEY`.
9. (Optional) Cloud storage connectors — Dropbox / OneDrive / Box PDF import (Solo+).

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
10. Create the Cloudflare Pages project (`wrangler pages deploy dist --project-name=chasa` from `apps/web` after building) and attach `chasa.io` as its custom domain; attach `api.chasa.io` as the Worker's custom domain — both via the Cloudflare dashboard.
11. Only switch to Stripe **live mode** keys/price/webhook once you've smoke-tested the whole flow in test mode.

AI email drafting uses **Cloudflare Workers AI** (free tier: 10,000 neurons/day) — no Anthropic or OpenAI key needed.

### Local secrets for `wrangler dev`

Create `apps/worker/.dev.vars` (gitignored) with test-mode values, e.g.:

```
TOKEN_SECRET=dev-secret-not-for-prod
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
# Optional Turnstile always-pass test keys (or omit both to bypass with a console warning):
# TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

Also set the matching test site key in `wrangler.toml` `[vars]` or `.dev.vars` as `TURNSTILE_SITE_KEY=1x00000000000000000000AA` if you want the widget to render locally.
To test the Stripe flow locally, forward webhooks with the Stripe CLI:

```bash
stripe listen --forward-to localhost:8787/api/billing/webhook
```
