import { Hono } from "hono";
import type { AuthEnv } from "../lib/auth";
import { requireAccount } from "../lib/auth";
import { getPublicTrustProfile, getTrustProfile, getTrustProfileProof } from "../lib/trustProfile";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const trust = new Hono<AuthEnv>();

/** The signed-in account's own trust profile status — null fields until an SSL domain is issued. */
trust.get("/mine", requireAccount, async (c) => {
  const acc = c.get("account")!;
  const profile = await getTrustProfile(c.env, acc.workspaceId);
  return c.json({ profile });
});

/** Public, no auth — backs the public /trust/:accountId page and the embeddable badge. Every
 *  field except "verified since" and the Bitcoin status is a live lookup, same rule as document
 *  certificates: never freeze a fact that can change (SSL status) into a fixed claim. */
trust.get("/public/:accountId", async (c) => {
  const profile = await getPublicTrustProfile(c.env, c.req.param("accountId"));
  if (!profile) return c.json({ error: "Not found" }, 404);
  return c.json(profile);
});

trust.get("/proof/:accountIdOts", async (c) => {
  const accountId = c.req.param("accountIdOts").replace(/\.ots$/i, "");
  const proof = await getTrustProfileProof(c.env, accountId);
  if (!proof) return c.json({ error: "No timestamp proof available yet" }, 404);
  const bytes = Uint8Array.from(atob(proof.proofBase64), (ch) => ch.charCodeAt(0));
  return c.body(bytes, 200, {
    "Content-Type": "application/octet-stream",
    "Content-Disposition": `attachment; filename="trust-profile-${accountId}.ots"`,
    "Cache-Control": "public, max-age=300",
  });
});

/** Small embeddable badge, same pattern as the document certificate badge — wording only claims
 *  what's actually verified: domain control (via a real issued SSL certificate) and, once
 *  confirmed, a Bitcoin-anchored "verified since" date. Never claims legal-entity verification —
 *  docstoc doesn't check business registries. */
trust.get("/badge/:accountIdJs", async (c) => {
  const accountId = c.req.param("accountIdJs").replace(/\.js$/i, "");
  const profile = await getPublicTrustProfile(c.env, accountId);
  if (!profile || profile.domainStatus !== "active") {
    return c.body("/* docstoc trust badge: no active verified domain */", 404, {
      "Content-Type": "application/javascript; charset=utf-8",
    });
  }
  const appOrigin = (c.env.PUBLIC_APP_URL || "https://chasa.io").replace(/\/$/, "");
  const profileUrl = `${appOrigin}/trust/${accountId}`;
  const label =
    profile.otsStatus === "confirmed"
      ? `Domain-verified since ${profile.verifiedSince.slice(0, 10)}`
      : "Domain-verified via docstoc";

  const script = `(function(){
  var a=document.createElement("a");
  a.href=${JSON.stringify(profileUrl)};
  a.target="_blank";
  a.rel="noopener noreferrer";
  a.style.cssText="display:inline-flex;align-items:center;gap:6px;font:12px/1.2 -apple-system,system-ui,sans-serif;color:#1B3155;text-decoration:none;border:1px solid #d8dee8;border-radius:6px;padding:6px 10px;background:#fafbfc";
  a.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2e7d32" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>' + ${JSON.stringify(escapeHtml(label))};
  var s=document.currentScript;
  if(s&&s.parentNode){s.parentNode.insertBefore(a,s);}else{document.write(a.outerHTML);}
})();`;

  return c.body(script, 200, {
    "Content-Type": "application/javascript; charset=utf-8",
    "Cache-Control": "public, max-age=300",
  });
});

export default trust;
