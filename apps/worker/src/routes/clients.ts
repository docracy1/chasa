import { Hono } from "hono";
import { requirePaidAccount, type AuthEnv } from "../lib/auth";

const clients = new Hono<AuthEnv>();

type ClientRow = {
  id: string;
  name: string;
  email: string | null;
  notes: string | null;
  last_contact_note: string | null;
  last_contact_at: string | null;
  created_at: string;
  updated_at: string;
  outstanding_count: number;
  outstanding_total: number;
};

function mapClient(row: ClientRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    notes: row.notes,
    lastContactNote: row.last_contact_note,
    lastContactAt: row.last_contact_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    outstandingCount: row.outstanding_count,
    outstandingTotal: row.outstanding_total,
  };
}

clients.get("/", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const { results } = await c.env.CHASA_DB.prepare(
    `SELECT c.id, c.name, c.email, c.notes, c.last_contact_note, c.last_contact_at,
            c.created_at, c.updated_at,
            COALESCE(SUM(a.amount), 0) as outstanding_total,
            COUNT(a.id) as outstanding_count
     FROM clients c
     LEFT JOIN aging_invoices a ON a.client_id = c.id AND a.account_id = c.account_id
     WHERE c.account_id = ?
     GROUP BY c.id
     ORDER BY c.name COLLATE NOCASE ASC`
  )
    .bind(acc.id)
    .all<ClientRow>();

  return c.json({ clients: (results ?? []).map(mapClient) });
});

clients.get("/:id", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const id = c.req.param("id");
  const row = await c.env.CHASA_DB.prepare(
    `SELECT c.id, c.name, c.email, c.notes, c.last_contact_note, c.last_contact_at,
            c.created_at, c.updated_at,
            COALESCE((SELECT SUM(amount) FROM aging_invoices WHERE client_id = c.id), 0) as outstanding_total,
            COALESCE((SELECT COUNT(*) FROM aging_invoices WHERE client_id = c.id), 0) as outstanding_count
     FROM clients c WHERE c.id = ? AND c.account_id = ?`
  )
    .bind(id, acc.id)
    .first<ClientRow>();

  if (!row) return c.json({ error: "Client not found" }, 404);

  const { results: invoices } = await c.env.CHASA_DB.prepare(
    `SELECT id, client_name, amount, due_date, last_chase_status, last_chase_at
     FROM aging_invoices WHERE account_id = ? AND client_id = ?
     ORDER BY due_date ASC`
  )
    .bind(acc.id, id)
    .all<{
      id: string;
      client_name: string;
      amount: number;
      due_date: string;
      last_chase_status: string | null;
      last_chase_at: string | null;
    }>();

  return c.json({
    client: mapClient(row),
    invoices: (invoices ?? []).map((inv) => ({
      id: inv.id,
      clientName: inv.client_name,
      amount: inv.amount,
      dueDate: inv.due_date,
      lastChaseStatus: inv.last_chase_status,
      lastChaseAt: inv.last_chase_at,
    })),
  });
});

clients.post("/", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const body = (await c.req.json().catch(() => ({}))) as {
    name?: unknown;
    email?: unknown;
    notes?: unknown;
  };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 120) {
    return c.json({ error: "Client name is required (max 120 characters)." }, 400);
  }
  const email =
    typeof body.email === "string" && body.email.trim() ? body.email.trim().slice(0, 200) : null;
  const notes =
    typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 2000) : null;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await c.env.CHASA_DB.prepare(
    `INSERT INTO clients (id, account_id, name, email, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, acc.id, name, email, notes, now, now)
    .run();

  return c.json(
    mapClient({
      id,
      name,
      email,
      notes,
      last_contact_note: null,
      last_contact_at: null,
      created_at: now,
      updated_at: now,
      outstanding_count: 0,
      outstanding_total: 0,
    }),
    201
  );
});

clients.put("/:id", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const id = c.req.param("id");
  const existing = await c.env.CHASA_DB.prepare(
    `SELECT id, name, email, notes, last_contact_note, last_contact_at, created_at, updated_at
     FROM clients WHERE id = ? AND account_id = ?`
  )
    .bind(id, acc.id)
    .first<{
      id: string;
      name: string;
      email: string | null;
      notes: string | null;
      last_contact_note: string | null;
      last_contact_at: string | null;
      created_at: string;
      updated_at: string;
    }>();
  if (!existing) return c.json({ error: "Client not found" }, 404);

  const body = (await c.req.json().catch(() => ({}))) as {
    name?: unknown;
    email?: unknown;
    notes?: unknown;
    lastContactNote?: unknown;
    clearLastContact?: unknown;
  };

  let name = existing.name;
  let email = existing.email;
  let notes = existing.notes;
  let lastContactNote = existing.last_contact_note;
  let lastContactAt = existing.last_contact_at;

  if (typeof body.name === "string") {
    const next = body.name.trim();
    if (!next || next.length > 120) {
      return c.json({ error: "Client name is required (max 120 characters)." }, 400);
    }
    name = next;
  }
  if (typeof body.email === "string") {
    email = body.email.trim() ? body.email.trim().slice(0, 200) : null;
  }
  if (typeof body.notes === "string") {
    notes = body.notes.trim() ? body.notes.trim().slice(0, 2000) : null;
  }
  if (body.clearLastContact === true) {
    lastContactNote = null;
    lastContactAt = null;
  } else if (typeof body.lastContactNote === "string") {
    const note = body.lastContactNote.trim().slice(0, 500);
    lastContactNote = note || null;
    lastContactAt = note ? new Date().toISOString() : null;
  }

  const now = new Date().toISOString();
  await c.env.CHASA_DB.prepare(
    `UPDATE clients SET name = ?, email = ?, notes = ?, last_contact_note = ?, last_contact_at = ?, updated_at = ?
     WHERE id = ? AND account_id = ?`
  )
    .bind(name, email, notes, lastContactNote, lastContactAt, now, id, acc.id)
    .run();

  // Keep aging rows' display name in sync when renamed
  if (name !== existing.name) {
    await c.env.CHASA_DB.prepare(
      `UPDATE aging_invoices SET client_name = ?, updated_at = ? WHERE client_id = ? AND account_id = ?`
    )
      .bind(name, now, id, acc.id)
      .run();
  }

  const totals = await c.env.CHASA_DB.prepare(
    `SELECT COALESCE(SUM(amount), 0) as outstanding_total, COUNT(*) as outstanding_count
     FROM aging_invoices WHERE client_id = ?`
  )
    .bind(id)
    .first<{ outstanding_total: number; outstanding_count: number }>();

  return c.json(
    mapClient({
      id,
      name,
      email,
      notes,
      last_contact_note: lastContactNote,
      last_contact_at: lastContactAt,
      created_at: existing.created_at,
      updated_at: now,
      outstanding_count: totals?.outstanding_count ?? 0,
      outstanding_total: totals?.outstanding_total ?? 0,
    })
  );
});

clients.delete("/:id", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const id = c.req.param("id");
  const result = await c.env.CHASA_DB.prepare(
    `DELETE FROM clients WHERE id = ? AND account_id = ?`
  )
    .bind(id, acc.id)
    .run();
  if (!result.meta.changes) return c.json({ error: "Client not found" }, 404);
  return c.json({ ok: true });
});

export default clients;
