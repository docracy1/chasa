import { Hono } from "hono";
import { requirePaidAccount, type AuthEnv } from "../lib/auth";
import { agingChaseSchema, agingSyncSchema, parseJsonBody } from "../lib/schemas";

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

/** Resolve client ids for a batch; creates missing clients in one batch. */
async function resolveClientIds(
  db: D1Database,
  accountId: string,
  names: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const map = new Map<string, string>();

  const { results } = await db
    .prepare(`SELECT id, name FROM clients WHERE account_id = ?`)
    .bind(accountId)
    .all<{ id: string; name: string }>();

  for (const row of results ?? []) {
    map.set(row.name.toLowerCase(), row.id);
  }

  const now = new Date().toISOString();
  const inserts: D1PreparedStatement[] = [];
  for (const name of unique) {
    const key = name.toLowerCase();
    if (map.has(key)) continue;
    const id = crypto.randomUUID();
    map.set(key, id);
    inserts.push(
      db.prepare(
        `INSERT INTO clients (id, account_id, name, email, notes, created_at, updated_at)
         VALUES (?, ?, ?, NULL, NULL, ?, ?)`
      ).bind(id, accountId, name, now, now)
    );
  }

  if (inserts.length > 0) {
    await db.batch(inserts);
  }

  return map;
}

aging.get("/", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const { results } = await c.env.CHASA_DB.prepare(
    `SELECT id, client_id, client_name, amount, due_date, last_chase_status, last_chase_at, created_at, updated_at
     FROM aging_invoices WHERE account_id = ?
     ORDER BY due_date ASC`
  )
    .bind(acc.workspaceId)
    .all<AgingRow>();

  return c.json({ invoices: (results ?? []).map(mapRow) });
});

/** Replace or upsert a batch of aging rows (from Tool CSV / manual list). */
aging.put("/sync", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const parsed = await parseJsonBody(c.req, agingSyncSchema);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);

  const { invoices: items, replace } = parsed.data;
  const now = new Date().toISOString();
  const clientMap = await resolveClientIds(
    c.env.CHASA_DB,
    acc.workspaceId,
    items.map((i) => i.clientName)
  );

  const stmts: D1PreparedStatement[] = [];
  if (replace === true) {
    stmts.push(
      c.env.CHASA_DB.prepare(`DELETE FROM aging_invoices WHERE account_id = ?`).bind(acc.workspaceId)
    );
  }

  const saved: ReturnType<typeof mapRow>[] = [];

  for (const item of items) {
    const clientId = clientMap.get(item.clientName.toLowerCase())!;
    const id = item.id?.trim() ? item.id.trim() : crypto.randomUUID();
    const status = item.lastChaseStatus?.trim() ? item.lastChaseStatus.trim().slice(0, 40) : null;
    const chaseAt = item.lastChaseAt?.trim() ? item.lastChaseAt.trim() : null;

    stmts.push(
      c.env.CHASA_DB.prepare(
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
      ).bind(
        id,
        acc.workspaceId,
        clientId,
        item.clientName,
        item.amount,
        item.dueDate,
        status,
        chaseAt,
        now,
        now
      )
    );

    saved.push(
      mapRow({
        id,
        client_id: clientId,
        client_name: item.clientName,
        amount: item.amount,
        due_date: item.dueDate,
        last_chase_status: status,
        last_chase_at: chaseAt,
        created_at: now,
        updated_at: now,
      })
    );
  }

  if (stmts.length > 0) {
    await c.env.CHASA_DB.batch(stmts);
  }

  return c.json({ invoices: saved, synced: saved.length });
});

aging.patch("/:id/chase", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const id = c.req.param("id");
  const parsed = await parseJsonBody(c.req, agingChaseSchema);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);

  const status = parsed.data.status?.trim() ? parsed.data.status.trim().slice(0, 40) : "drafted";
  const now = new Date().toISOString();

  const result = await c.env.CHASA_DB.prepare(
    `UPDATE aging_invoices SET last_chase_status = ?, last_chase_at = ?, updated_at = ?
     WHERE id = ? AND account_id = ?`
  )
    .bind(status, now, now, id, acc.workspaceId)
    .run();

  if (!result.meta.changes) return c.json({ error: "Invoice not found" }, 404);
  return c.json({ ok: true, lastChaseStatus: status, lastChaseAt: now });
});

aging.delete("/:id", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const result = await c.env.CHASA_DB.prepare(
    `DELETE FROM aging_invoices WHERE id = ? AND account_id = ?`
  )
    .bind(c.req.param("id"), acc.workspaceId)
    .run();
  if (!result.meta.changes) return c.json({ error: "Invoice not found" }, 404);
  return c.json({ ok: true });
});

export default aging;
