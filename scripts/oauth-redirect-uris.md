# OAuth redirect URIs (docstoc.io cutover)

Register these in each provider console. Worker env uses `PUBLIC_WORKER_URL=https://api.docstoc.io`.

## Google Cloud Console (Sign-In + Drive connector)

**Authorized redirect URIs** (both OAuth clients if split):

- `https://api.docstoc.io/api/auth/google/callback`
- `https://api.docstoc.io/api/account/connectors/google/callback`

Keep legacy URIs on `api.chasa.io` until traffic drops, then remove after cutover:

- `https://api.chasa.io/api/auth/google/callback`
- `https://api.chasa.io/api/account/connectors/google/callback`

## Other connectors (same pattern on api.docstoc.io)

- Dropbox: `/api/account/connectors/dropbox/callback`
- OneDrive: `/api/account/connectors/onedrive/callback`
- Box: `/api/account/connectors/box/callback`
- QuickBooks: `/api/account/connectors/quickbooks/callback`
- Xero: `/api/account/connectors/xero/callback`

## Stripe webhook

- `https://api.docstoc.io/api/billing/webhook`
