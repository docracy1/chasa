import { Hono } from "hono";
import { requirePaidAccount, type AuthEnv } from "../lib/auth";

const aging = new Hono<AuthEnv>();

type AgingRow = {
  id: string;
  client_id: string | null;
  client_name: string;
  amount: number;
  due_date: string;
  last_chase_status: string | null;
  last_chase_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: AgingRow) {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    amount: row.amount,
    dueDate: row.due_date,
    lastChaseStatus: row.last_chase_status,
    lastChaseAt: row.last_chase_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function findOrCreateClientId(
  db: D1Database,
  accountId: string,
  clientName: string
): Promise<string> {
  const existing = await db
    .prepare(
      `SELECT id FROM clients WHERE account_id = ? AND name = ? COLLATE NOCASE LIMIT 1`
    )
    .bind(accountId, clientName)
    .first<{ id: string }>();
  if (existing) return existing.id;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO clients (id, account_id, name, email, notes, created_at, updated_at)
       VALUES (?, ?, ?, NULL, NULL, ?, ?)`
    )
    .bind(id, accountId, clientName, now, now)
    .run();
  return id;
}

aging.get("/", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const { results } = await c.env.CHASA_DB.prepare(
    `SELECT id, client_id, client_name, amount, due_date, last_chase_status, last_chase_at, created_at, updated_at
     FROM aging_invoices WHERE account_id = ?
     ORDER BY due_date ASC`
  )
    .bind(acc.id)
    .all<AgingRow>();

  return c.json({ invoices: (results ?? []).map(mapRow) });
});

/** Replace or upsert a batch of aging rows (from Tool CSV / manual list). */
aging.put("/sync", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const body = (await c.req.json().catch(() => ({}))) as {
    invoices?: Array<{
      id?: string;
      clientName?: string;
      amount?: number;
      dueDate?: string;
      lastChaseStatus?: string | null;
      lastChaseAt?: string | null;
    }>;
    replace?: boolean;
  };

  const items = Array.isArray(body.invoices) ? body.invoices : [];
  if (items.length > 500) {
    return c.json({ error: "Maximum 500 aging rows per sync." }, 400);
  }

  const now = new Date().toISOString();
  if (body.replace === true) {
    await c.env.CHASA_DB.prepare(`DELETE FROM aging_invoices WHERE account_id = ?`)
      .bind(acc.id)
      .run();
  }

  const saved: ReturnType<typeof mapRow>[] = [];

  for (const item of items) {
    const clientName = typeof item.clientName === "string" ? item.clientName.trim() : "";
    const amount = Number(item.amount);
    const dueDate = typeof item.dueDate === "string" ? item.dueDate.trim() : "";
    if (!clientName || !Number.isFinite(amount) || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      continue;
    }

    const clientId = await findOrCreateClientId(c.env.CHASA_DB, acc.id, clientName);
    const id =
      typeof item.id === "string" && item.id.trim() ? item.id.trim() : crypto.randomUUID();
    const status =
      typeof item.lastChaseStatus === "string" && item.lastChaseStatus.trim()
        ? item.lastChaseStatus.trim().slice(0, 40)
        : null;
    const chaseAt =
      typeof item.lastChaseAt === "string" && item.lastChaseAt.trim()
        ? item.lastChaseAt.trim()
        : null;

    await c.env.CHASA_DB.prepare(
      `INSERT INTO aging_invoices
         (id, account_id, client_id, client_name, amount, due_date, last_chase_status, last_chase_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         client_id = excluded.client_id,
         client_name = excluded.client_name,
         amount = excluded.amount,
         due_date = excluded.due_date,
         last_chase_status = COALESCE(excluded.last_chase_status, aging_invoices.last_chase_status),
         last_chase_at = COALESCE(excluded.last_chase_at, aging_invoices.last_chase_at),
         updated_at = excluded.updated_at
       WHERE aging_invoices.account_id = excluded.account_id`
    )
      .bind(id, acc.id, clientId, clientName, amount, dueDate, status, chaseAt, now, now)
      .run();

    saved.push(
      mapRow({
        id,
        client_id: clientId,
        client_name: clientName,
        amount,
        due_date: dueDate,
        last_chase_status: status,
        last_chase_at: chaseAt,
        created_at: now,
        updated_at: now,
      })
    );
  }

  return c.json({ invoices: saved, synced: saved.length });
});

aging.patch("/:id/chase", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as { status?: unknown };
  const status =
    typeof body.status === "string" && body.status.trim()
      ? body.status.trim().slice(0, 40)
      : "drafted";
  const now = new Date().toISOString();

  const result = await c.env.CHASA_DB.prepare(
    `UPDATE aging_invoices SET last_chase_status = ?, last_chase_at = ?, updated_at = ?
     WHERE id = ? AND account_id = ?`
  )
    .bind(status, now, now, id, acc.id)
    .run();

  if (!result.meta.changes) return c.json({ error: "Invoice not found" }, 404);
  return c.json({ ok: true, lastChaseStatus: status, lastChaseAt: now });
});

aging.delete("/:id", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const result = await c.env.CHASA_DB.prepare(
    `DELETE FROM aging_invoices WHERE id = ? AND account_id = ?`
  )
    .bind(c.req.param("id"), acc.id)
    .run();
  if (!result.meta.changes) return c.json({ error: "Invoice not found" }, 404);
  return c.json({ ok: true });
});

export default aging;
