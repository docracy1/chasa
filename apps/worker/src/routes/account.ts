import { Hono } from "hono";
import { requireAccount, requirePaidAccount, requireWorkspaceAdmin, type AuthEnv } from "../lib/auth";
import { isAdminEmail } from "../lib/adminAuth";
import cloudConnectors from "./cloudConnectors";
import googleIntegrations from "./googleIntegrations";
import { importLocalPdfBytes } from "../lib/pdfInvoiceHints";
import { brandingUpdateSchema, digestSettingsSchema, parseJsonBody, validateWorkspaceName } from "../lib/schemas";

const account = new Hono<AuthEnv>();

account.route("/connectors", cloudConnectors);
account.route("/google", googleIntegrations);

account.get("/me", requireAccount, async (c) => {
  const acc = c.get("account")!;
  const row = await c.env.CHASA_DB.prepare(
    `SELECT workspace_name, logo_data, payment_link, late_fee_enabled, late_fee_hint, digest_enabled FROM accounts WHERE id = ?`
  )
    .bind(acc.workspaceId)
    .first<{
      workspace_name: string | null;
      logo_data: string | null;
      payment_link: string | null;
      late_fee_enabled: number | null;
      late_fee_hint: string | null;
      digest_enabled: number | null;
    }>();

  return c.json({
    email: acc.email,
    plan: acc.plan,
    workspaceName: row?.workspace_name ?? null,
    logoDataUrl: row?.logo_data ?? null,
    paymentLink: row?.payment_link ?? null,
    lateFeeEnabled: !!(row?.late_fee_enabled),
    lateFeeHint: row?.late_fee_hint ?? null,
    digestEnabled: row?.digest_enabled !== 0,
    role: acc.role,
    workspaceId: acc.workspaceId,
    isAdmin: isAdminEmail(c.env, acc.email),
  });
});

account.get("/branding", requireAccount, async (c) => {
  const acc = c.get("account")!;
  const row = await c.env.CHASA_DB.prepare(
    `SELECT workspace_name, logo_data, payment_link, late_fee_enabled, late_fee_hint FROM accounts WHERE id = ?`
  )
    .bind(acc.workspaceId)
    .first<{
      workspace_name: string | null;
      logo_data: string | null;
      payment_link: string | null;
      late_fee_enabled: number | null;
      late_fee_hint: string | null;
    }>();

  return c.json({
    workspaceName: row?.workspace_name ?? null,
    logoDataUrl: row?.logo_data ?? null,
    paymentLink: row?.payment_link ?? null,
    lateFeeEnabled: !!(row?.late_fee_enabled),
    lateFeeHint: row?.late_fee_hint ?? null,
    paid: acc.isPaid,
  });
});

const MAX_LOGO_CHARS = 140_000; // ~100KB binary as data URL

account.put("/branding", requireWorkspaceAdmin, async (c) => {
  const acc = c.get("account")!;
  const parsed = await parseJsonBody(c.req, brandingUpdateSchema);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const body = parsed.data;

  const current = await c.env.CHASA_DB.prepare(
    `SELECT workspace_name, logo_data, payment_link, late_fee_enabled, late_fee_hint FROM accounts WHERE id = ?`
  )
    .bind(acc.workspaceId)
    .first<{
      workspace_name: string | null;
      logo_data: string | null;
      payment_link: string | null;
      late_fee_enabled: number | null;
      late_fee_hint: string | null;
    }>();

  let workspaceName = current?.workspace_name ?? null;
  let logoData = current?.logo_data ?? null;
  let paymentLink = current?.payment_link ?? null;
  let lateFeeEnabled = !!(current?.late_fee_enabled);
  let lateFeeHint = current?.late_fee_hint ?? null;

  if (body.removeName === true) {
    workspaceName = null;
  } else if (typeof body.workspaceName === "string") {
    const name = body.workspaceName.trim();
    if (name.length === 0) {
      workspaceName = null;
    } else if (name.length < 3 || name.length > 30 || !validateWorkspaceName(name)) {
      return c.json(
        { error: "Workspace name: 3–30 characters, letters and numbers only (spaces/_/- ok in the middle)." },
        400
      );
    } else {
      workspaceName = name;
    }
  }

  if (body.removeLogo === true) {
    logoData = null;
  } else if (typeof body.logoDataUrl === "string") {
    const dataUrl = body.logoDataUrl.trim();
    if (!dataUrl.startsWith("data:image/")) {
      return c.json({ error: "Logo must be a PNG, JPEG, or WebP image." }, 400);
    }
    if (!/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(dataUrl)) {
      return c.json({ error: "Logo must be a PNG, JPEG, or WebP image." }, 400);
    }
    if (dataUrl.length > MAX_LOGO_CHARS) {
      return c.json({ error: "Logo is too large — keep under ~100KB." }, 400);
    }
    logoData = dataUrl;
  }

  if (body.removePaymentLink === true) {
    paymentLink = null;
  } else if (typeof body.paymentLink === "string") {
    const link = body.paymentLink.trim();
    if (link.length === 0) {
      paymentLink = null;
    } else if (!/^https?:\/\//i.test(link) || link.length > 500) {
      return c.json(
        { error: "Payment link must be an http(s) URL under 500 characters." },
        400
      );
    } else {
      paymentLink = link;
    }
  }

  if (typeof body.lateFeeEnabled === "boolean") {
    lateFeeEnabled = body.lateFeeEnabled;
  }
  if (typeof body.lateFeeHint === "string") {
    const hint = body.lateFeeHint.trim().slice(0, 200);
    lateFeeHint = hint.length ? hint : null;
  }
  if (!lateFeeEnabled) {
    // keep hint stored but disabled
  }

  await c.env.CHASA_DB.prepare(
    `UPDATE accounts SET workspace_name = ?, logo_data = ?, payment_link = ?, late_fee_enabled = ?, late_fee_hint = ? WHERE id = ?`
  )
    .bind(
      workspaceName,
      logoData,
      paymentLink,
      lateFeeEnabled ? 1 : 0,
      lateFeeHint,
      acc.workspaceId
    )
    .run();

  return c.json({
    workspaceName,
    logoDataUrl: logoData,
    paymentLink,
    lateFeeEnabled,
    lateFeeHint,
    paid: true,
  });
});

account.patch("/digest", requireAccount, async (c) => {
  const acc = c.get("account")!;
  if (!acc.isPaid) {
    return c.json({ error: "Daily chase digest requires a Solo or Pro plan." }, 403);
  }
  const parsed = await parseJsonBody(c.req, digestSettingsSchema);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  await c.env.CHASA_DB.prepare(`UPDATE accounts SET digest_enabled = ? WHERE id = ?`)
    .bind(parsed.data.digestEnabled ? 1 : 0, acc.workspaceId)
    .run();
  return c.json({ digestEnabled: parsed.data.digestEnabled });
});

/** Local PDF upload from New chase — same hint shape as cloud connector import. */
account.post("/pdf/import", requirePaidAccount, async (c) => {
  let body: { filename?: string; base64?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const filename = typeof body.filename === "string" ? body.filename : "";
  const base64 = typeof body.base64 === "string" ? body.base64.replace(/^data:application\/pdf;base64,/, "") : "";
  if (!base64) return c.json({ error: "base64 is required" }, 400);
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const result = importLocalPdfBytes(filename || "invoice.pdf", bytes.buffer);
    return c.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not import PDF";
    if (
      msg.startsWith("File too large") ||
      msg.startsWith("Only PDF") ||
      msg.startsWith("File does not") ||
      msg.startsWith("Uploaded file")
    ) {
      return c.json({ error: msg }, 400);
    }
    return c.json({ error: msg }, 502);
  }
});

export default account;
