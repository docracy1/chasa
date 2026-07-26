import { Hono } from "hono";
import { requireAccount, requirePaidAccount, type AuthEnv } from "../lib/auth";
import cloudConnectors from "./cloudConnectors";

const account = new Hono<AuthEnv>();

account.route("/connectors", cloudConnectors);

account.get("/me", requireAccount, async (c) => {
  const acc = c.get("account")!;
  const row = await c.env.CHASA_DB.prepare(
    `SELECT workspace_name, logo_data FROM accounts WHERE id = ?`
  )
    .bind(acc.id)
    .first<{ workspace_name: string | null; logo_data: string | null }>();

  return c.json({
    email: acc.email,
    plan: acc.plan,
    workspaceName: row?.workspace_name ?? null,
    logoDataUrl: row?.logo_data ?? null,
  });
});

account.get("/branding", requireAccount, async (c) => {
  const acc = c.get("account")!;
  const row = await c.env.CHASA_DB.prepare(
    `SELECT workspace_name, logo_data FROM accounts WHERE id = ?`
  )
    .bind(acc.id)
    .first<{ workspace_name: string | null; logo_data: string | null }>();

  return c.json({
    workspaceName: row?.workspace_name ?? null,
    logoDataUrl: row?.logo_data ?? null,
    paid: acc.isPaid,
  });
});

const NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9 _-]{1,28}[a-zA-Z0-9]$|^[a-zA-Z0-9]{3,30}$/;
const MAX_LOGO_CHARS = 140_000; // ~100KB binary as data URL

account.put("/branding", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const body = (await c.req.json().catch(() => ({}))) as {
    workspaceName?: unknown;
    logoDataUrl?: unknown;
    removeLogo?: unknown;
    removeName?: unknown;
  };

  const current = await c.env.CHASA_DB.prepare(
    `SELECT workspace_name, logo_data FROM accounts WHERE id = ?`
  )
    .bind(acc.id)
    .first<{ workspace_name: string | null; logo_data: string | null }>();

  let workspaceName = current?.workspace_name ?? null;
  let logoData = current?.logo_data ?? null;

  if (body.removeName === true) {
    workspaceName = null;
  } else if (typeof body.workspaceName === "string") {
    const name = body.workspaceName.trim();
    if (name.length === 0) {
      workspaceName = null;
    } else if (name.length < 3 || name.length > 30 || !NAME_RE.test(name)) {
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

  await c.env.CHASA_DB.prepare(
    `UPDATE accounts SET workspace_name = ?, logo_data = ? WHERE id = ?`
  )
    .bind(workspaceName, logoData, acc.id)
    .run();

  return c.json({
    workspaceName,
    logoDataUrl: logoData,
    paid: true,
  });
});

export default account;
