import { Hono } from "hono";
import type { AuthEnv } from "../lib/auth";
import { requirePaidAccount } from "../lib/auth";
import { createOrder, finalizeAndDownload, getDns01Challenge, getOrder, loadOrCreateAccount, verifyDns01 } from "../lib/acme";
import {
  createCertificateRow,
  deleteCertificateRow,
  getCertificateRow,
  listCertificatesForAccount,
  setFailed,
  setIssued,
  setOrderDetails,
  setVerifying,
} from "../lib/customerCertificates";
import { encryptSecret, decryptSecret } from "../lib/secretCrypto";
import { customHostnameCreateSchema, parseJsonBody } from "../lib/schemas";
import { ensureTrustProfile, submitTrustProfileTimestamp } from "../lib/trustProfile";
import { sslDomainLimit } from "../lib/plan";

const ssl = new Hono<AuthEnv>();

/** Custom-domain SSL: Pro = 1 domain, Business = multi-domain (see sslDomainLimit). */
ssl.use("*", requirePaidAccount);

ssl.get("/domains", async (c) => {
  const acc = c.get("account")!;
  const certificates = await listCertificatesForAccount(c.env, acc.workspaceId);
  return c.json({ certificates, limit: sslDomainLimit(acc.plan) });
});

ssl.post("/domains", async (c) => {
  const acc = c.get("account")!;
  const parsed = await parseJsonBody(c.req, customHostnameCreateSchema);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const domain = parsed.data.hostname;

  const limit = sslDomainLimit(acc.plan);
  const existing = await listCertificatesForAccount(c.env, acc.workspaceId);
  if (existing.length >= limit) {
    return c.json(
      {
        error:
          limit <= 1
            ? "Pro includes 1 custom domain. Upgrade to Business for more domains and trust badges."
            : `Business plan allows up to ${limit} custom domains.`,
        limit,
        used: existing.length,
      },
      402
    );
  }

  const row = await createCertificateRow(c.env, acc.workspaceId, domain);
  try {
    const account = await loadOrCreateAccount(c.env);
    const order = await createOrder(account, domain);
    const challenge = await getDns01Challenge(account, order.authorizationUrl);
    await setOrderDetails(c.env, row.id, {
      orderUrl: order.orderUrl,
      dns01Token: challenge.token,
      dns01TxtValue: challenge.txtValue,
    });
    return c.json({
      certificate: { ...row, dns01Token: challenge.token, dns01TxtValue: challenge.txtValue },
      dnsRecord: { name: `_acme-challenge.${domain}`, type: "TXT", value: challenge.txtValue },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ACME order failed";
    await setFailed(c.env, row.id, message);
    return c.json({ error: message }, 502);
  }
});

/** Customer clicks this after adding the TXT record. One bounded verification attempt — see
 *  lib/acme.ts's verifyDns01/finalizeAndDownload for the poll limits. */
ssl.post("/domains/:id/verify", async (c) => {
  const acc = c.get("account")!;
  const row = await getCertificateRow(c.env, acc.workspaceId, c.req.param("id"));
  if (!row) return c.json({ error: "Not found" }, 404);
  if (!row.order_url) return c.json({ error: "No pending order for this domain" }, 400);

  await setVerifying(c.env, row.id);
  try {
    const account = await loadOrCreateAccount(c.env);
    const order = await getOrder(account, row.order_url);
    const challenge = await getDns01Challenge(account, order.authorizationUrl);
    const verified = await verifyDns01(account, order.authorizationUrl, challenge.challengeUrl);

    if (verified.status === "invalid") {
      await setFailed(c.env, row.id, verified.error ?? "DNS-01 validation failed");
      return c.json({ status: "invalid", error: verified.error });
    }
    if (verified.status === "pending") {
      return c.json({ status: "pending" });
    }

    const issued = await finalizeAndDownload(account, order, row.domain);
    if ("pending" in issued) {
      return c.json({ status: "pending" });
    }

    const certKeyEnc = await encryptSecret(JSON.stringify(issued.privateKeyJwk), c.env.TOKEN_SECRET);
    // Let's Encrypt certificates are always valid for exactly 90 days from issuance — this avoids
    // needing an X.509 parser (Workers has none) just to read the real expiry back out.
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    await setIssued(c.env, row.id, { certKeyEnc, certPem: issued.certPem, expiresAt });

    // First real, DNS-proven domain for this account — create its trust profile and anchor the
    // "verified since" claim in the background. A no-op if one already exists.
    const newProfile = await ensureTrustProfile(c.env, acc.workspaceId);
    if (newProfile) {
      c.executionCtx.waitUntil(
        submitTrustProfileTimestamp(c.env, acc.workspaceId, newProfile.hash).catch((err) =>
          console.error("Trust profile timestamp submission threw:", err)
        )
      );
    }

    return c.json({ status: "issued" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed";
    await setFailed(c.env, row.id, message);
    return c.json({ status: "error", error: message }, 502);
  }
});

/** Let's Encrypt certs are 90 days and DNS-01 always needs a fresh challenge value per order —
 *  there's no per-registrar DNS API to update that TXT record unattended, so "renew" means
 *  issuing a brand-new order for the same domain/row and asking the customer to swap in the new
 *  TXT value, not a silent background renewal. Reuses the row so history/id stay stable instead
 *  of making the customer delete and re-add the domain from scratch. */
ssl.post("/domains/:id/renew", async (c) => {
  const acc = c.get("account")!;
  const row = await getCertificateRow(c.env, acc.workspaceId, c.req.param("id"));
  if (!row) return c.json({ error: "Not found" }, 404);

  try {
    const account = await loadOrCreateAccount(c.env);
    const order = await createOrder(account, row.domain);
    const challenge = await getDns01Challenge(account, order.authorizationUrl);
    await setOrderDetails(c.env, row.id, {
      orderUrl: order.orderUrl,
      dns01Token: challenge.token,
      dns01TxtValue: challenge.txtValue,
    });
    return c.json({
      certificate: { ...row, dns01Token: challenge.token, dns01TxtValue: challenge.txtValue },
      dnsRecord: { name: `_acme-challenge.${row.domain}`, type: "TXT", value: challenge.txtValue },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ACME renewal order failed";
    await setFailed(c.env, row.id, message);
    return c.json({ error: message }, 502);
  }
});

ssl.delete("/domains/:id", async (c) => {
  const acc = c.get("account")!;
  const deleted = await deleteCertificateRow(c.env, acc.workspaceId, c.req.param("id"));
  if (!deleted) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

/** Download issued certificate material for server installation (certificate PEM + private key PEM). */
ssl.get("/domains/:id/download", async (c) => {
  const acc = c.get("account")!;
  const row = await getCertificateRow(c.env, acc.workspaceId, c.req.param("id"));
  if (!row) return c.json({ error: "Not found" }, 404);
  if (row.status !== "issued" && row.status !== "expiring") {
    return c.json({ error: "Certificate is not issued yet" }, 400);
  }
  if (!row.cert_pem || !row.cert_key_enc) {
    return c.json({ error: "Certificate files are not available" }, 404);
  }

  try {
    const jwkJson = await decryptSecret(row.cert_key_enc, c.env.TOKEN_SECRET);
    const jwk = JSON.parse(jwkJson) as JsonWebKey;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
    const pkcs8 = await crypto.subtle.exportKey("pkcs8", key);
    const privateKeyPem = arrayBufferToPem(pkcs8, "PRIVATE KEY");
    return c.json({
      domain: row.domain,
      certificatePem: row.cert_pem,
      privateKeyPem,
      expiresAt: row.expires_at,
      formats: {
        nginx: "Use certificatePem as fullchain (or split leaf+chain) and privateKeyPem as the key file.",
        apache: "Use certificatePem for SSLCertificateFile and privateKeyPem for SSLCertificateKeyFile.",
        caddy: "Point tls directives at the PEM files, or paste into your Caddyfile as needed.",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not export certificate";
    return c.json({ error: message }, 500);
  }
});

function arrayBufferToPem(buf: ArrayBuffer, label: string): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  const b64 = btoa(binary);
  const lines = b64.match(/.{1,64}/g) ?? [b64];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
}

export default ssl;
