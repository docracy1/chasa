# acme-relay

A tiny, stateless HTTPS forwarder that lets docstoc's ACME client (`apps/worker/src/lib/acme.ts`)
reach Let's Encrypt. It exists solely because **Cloudflare Workers cannot reliably reach Let's
Encrypt's ACME API** — outbound `fetch()` from a deployed Worker to
`acme-v02.api.letsencrypt.org` or `acme-staging-v02.api.letsencrypt.org` fails with a `525 SSL
handshake` error, a known, unresolved issue on Cloudflare's side (confirmed via Cloudflare's own
community forums — search "Workers acme-v02 525" — with no fix as of this writing). The exact
same request works from any non-Cloudflare host, hence this relay.

**This process holds no secrets.** It never sees an ACME account key, a certificate private key,
or docstoc's database — it only forwards already-built (already-signed, where relevant) HTTP
requests to Let's Encrypt and returns the raw response. The only thing worth protecting is the
shared bearer secret, which just prevents randoms from using it as an open proxy.

## Deploy it on Deno Deploy (free tier)

`main.ts` is the Deno-native version of this relay (same logic as `relay.mjs`, using
`Deno.serve()` and standard Web `Request`/`Response` instead of Node's `http` module). It must
NOT be Cloudflare-hosted (that's the whole point) — Deno Deploy works because it's a normal
network path to Let's Encrypt, unrelated to Cloudflare's.

Deno Deploy's free tier is edge-deployed rather than a single always-on VM, so there's no
scale-to-zero cold-start tradeoff to reason about the way there is with Render/Koyeb-style free
tiers — 1M requests/month free, no credit card required for that baseline.

```bash
# 1. Install Deno if you don't have it:
curl -fsSL https://deno.land/install.sh | sh

# 2. Sign in — opens a browser to authorize the CLI against your Deno account (GitHub login
#    works). Run this yourself:
deno login

# 3. Generate the shared secret (never commit the raw value) and deploy this directory:
cd apps/acme-relay
RELAY_SECRET="$(openssl rand -hex 32)"
echo "Save this — you'll paste it into the worker too: $RELAY_SECRET"
deno deploy --env RELAY_SECRET="$RELAY_SECRET"
```

The `deno deploy` command will prompt you to name the app on first deploy (e.g.
`docstoc-acme-relay`) and prints the public `https://<app>.deno.dev`-style URL when it finishes —
that's the value for `ACME_RELAY_URL` below. Re-running `deno deploy` from this directory later
redeploys the same app.

Any other small Node 18+ host works too (Fly.io, Render, an existing box) if you'd rather not use
Deno Deploy — same `RELAY_SECRET` env var, use `relay.mjs` instead of `main.ts`, just
`RELAY_SECRET=... node relay.mjs`.

## Point docstoc at it

Once deployed and reachable over HTTPS, set these on the worker:

```bash
cd ../worker
wrangler secret put ACME_RELAY_URL
# paste: the https://<app>.deno.dev URL `deno deploy` printed
wrangler secret put ACME_RELAY_SECRET
# paste: the same RELAY_SECRET you generated above
```

Nothing else changes — `apps/worker/src/lib/acme.ts` routes every Let's-Encrypt-bound request
through this relay automatically once those two secrets are set. Until they're set, the SSL
custom-domain feature returns a clear "not configured" error rather than doing anything unsafe.

## Security notes

- The relay only forwards to `acme-v02.api.letsencrypt.org` and
  `acme-staging-v02.api.letsencrypt.org` — any other target host is rejected with 403. Don't
  widen this allowlist without a reason.
- Requires `Authorization: Bearer <RELAY_SECRET>` on every request — anyone with that secret can
  make it forward requests to Let's Encrypt on your behalf (not much of a blast radius, since it
  never handles your keys, but rotate the secret if it ever leaks).
- Run it behind HTTPS (most PaaS hosts terminate TLS for you automatically — if you're running it
  on a bare VM yourself, put a reverse proxy like Caddy in front of it for free automatic TLS).
