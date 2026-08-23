import { Hono } from "hono";
import type { AuthEnv } from "../lib/auth";
import { requireAccount } from "../lib/auth";
import {
  createInvoice,
  deleteInvoice,
  getInvoice,
  getInvoiceByPublicId,
  listInvoicesForAccount,
  setInvoiceStatus,
} from "../lib/invoices";
import { getBrandingRow } from "./account";
import { invoiceCreateSchema, invoiceStatusSchema, parseJsonBody } from "../lib/schemas";

const invoices = new Hono<AuthEnv>();

invoices.get("/", requireAccount, async (c) => {
  const acc = c.get("account")!;
  const list = await listInvoicesForAccount(c.env, acc.workspaceId);
  return c.json({ invoices: list });
});

invoices.post("/", requireAccount, async (c) => {
  const acc = c.get("account")!;
  const parsed = await parseJsonBody(c.req, invoiceCreateSchema);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const body = parsed.data;

  const invoice = await createInvoice(c.env, acc.workspaceId, {
    clientName: body.clientName,
    clientEmail: body.clientEmail || null,
    issueDate: body.issueDate,
    dueDate: body.dueDate,
    currency: body.currency,
    lineItems: body.lineItems,
    taxRate: body.taxRate,
    notes: body.notes || null,
  });
  return c.json({ ok: true, invoice });
});

invoices.get("/:id", requireAccount, async (c) => {
  const acc = c.get("account")!;
  const invoice = await getInvoice(c.env, acc.workspaceId, c.req.param("id"));
  if (!invoice) return c.json({ error: "Not found" }, 404);
  return c.json({ invoice });
});

invoices.patch("/:id/status", requireAccount, async (c) => {
  const acc = c.get("account")!;
  const parsed = await parseJsonBody(c.req, invoiceStatusSchema);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const invoice = await setInvoiceStatus(c.env, acc.workspaceId, c.req.param("id"), parsed.data.status);
  if (!invoice) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true, invoice });
});

invoices.delete("/:id", requireAccount, async (c) => {
  const acc = c.get("account")!;
  const ok = await deleteInvoice(c.env, acc.workspaceId, c.req.param("id"));
  if (!ok) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

/** Public, no auth — backs the printable /invoice/:id page. */
invoices.get("/public/:publicId", async (c) => {
  const invoice = await getInvoiceByPublicId(c.env, c.req.param("publicId"));
  if (!invoice) return c.json({ error: "Not found" }, 404);
  const branding = await getBrandingRow(c.env, invoice.accountId);
  return c.json({
    invoice,
    from: {
      name: branding?.workspace_name || "docstoc.io account",
      logoDataUrl: branding?.logo_data || null,
      paymentLink: branding?.payment_link || null,
    },
  });
});

export default invoices;
