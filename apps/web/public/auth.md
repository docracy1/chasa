# Docstoc — Agent Authentication

Docstoc does not use OAuth or OpenID Connect for agents. There is no dynamic client registration
endpoint, no authorization/token endpoint, and no `/.well-known/oauth-authorization-server`.

## How authentication actually works

- **Human users**: passwordless magic-link email sign-in at `https://chasa.io/app/login`. Clicking
  the one-time link creates a session cookie. The first sign-in also creates the account.
- **Agents and the HTTP API**: a static Bearer API key (format `docstoc_...`), created by a signed-in
  paid user from `https://chasa.io/app/connector`.
- **MCP**: mixed auth.
  - `get_chase_tip`, `recommend_template`, and `list_templates` are public.
  - `draft_chase_email` requires either a browser session cookie or a Bearer API key.

## Using the key

```
Authorization: Bearer <your-api-key>
```

This works for:

- The HTTP API at `POST https://api.docstoc.io/api/v1/chase/draft`
- MCP requests to `https://api.docstoc.io/mcp` when calling `draft_chase_email`
- Zapier / Make / custom scripts

## What the key can and can't do

- One key per workspace, full access to that workspace's paid API features.
- No scopes or per-tool permissions.
- No public self-service registration endpoint for agents.
- Regenerating the key from the Connector page invalidates the previous one.

## Authentication guidance for agents

- Do not assume Docstoc can send email on the user's behalf. It drafts follow-up copy only.
- Prefer public MCP tools for template lookup and chase-tone guidance when no user auth is present.
- Use the paid API key only when a human has already created it from the app.
