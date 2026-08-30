# OAuth redirect URIs (docstoc.io cutover)

Register these in each provider console. Worker env uses `PUBLIC_WORKER_URL=https://api.docstoc.io`.

**Full setup walkthrough:** [`connectors-docstoc-setup.md`](connectors-docstoc-setup.md)

## Google Cloud Console

| OAuth client | Redirect URI |
|--------------|--------------|
| **Sign-In** (`GOOGLE_LOGIN_CLIENT_ID`) | `https://api.docstoc.io/api/auth/google/callback` |
| **Integrations** (`GOOGLE_INTEGRATIONS_CLIENT_ID`) | `https://api.docstoc.io/api/account/connectors/google/callback` |

Keep legacy `api.chasa.io` URIs until traffic drops.

## Other connectors

| Provider | Redirect URI |
|----------|--------------|
| Dropbox | `https://api.docstoc.io/api/account/connectors/dropbox/callback` |
| OneDrive | `https://api.docstoc.io/api/account/connectors/onedrive/callback` |
| Box | `https://api.docstoc.io/api/account/connectors/box/callback` |
| QuickBooks | `https://api.docstoc.io/api/account/connectors/quickbooks/callback` |
| Xero | `https://api.docstoc.io/api/account/connectors/xero/callback` |

## Stripe webhook

Unchanged — `https://api.docstoc.io/api/billing/webhook` (or keep chasa during transition).
