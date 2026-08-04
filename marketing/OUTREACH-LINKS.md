# Outreach tracking links

Use these instead of bare `chasa.io` in cold email / DMs so Admin → Analytics shows opens.

| Link | Lands on | Use |
|------|----------|-----|
| https://chasa.io/go/dm | Homepage | Cold email / DM (default) |
| https://chasa.io/go/dm?who=alice | Homepage | Per-prospect — shows under **By who** |
| https://chasa.io/go/li | Homepage | LinkedIn |
| https://chasa.io/go/x | Homepage | X |
| https://chasa.io/go/try | `/app/` | “Try free” CTA |
| https://chasa.io/go/templates | Free templates | Template pack pitch |

**Tip:** `?who=` can be a first name, company slug, or email (`?who=alice@studio.com`). Keep it consistent so the admin table is readable.

Opens are logged **server-side** when the short link is hit (before cookie consent), then the visitor is redirected with UTMs. View results at `/app/admin` → Analytics → **Outreach link opens**.
