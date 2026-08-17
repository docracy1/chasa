import type { Env } from "../types";

/** Same shape as the static FreeChaseTemplate the app's Templates page already renders (see
 *  apps/web/app/src/pages/Templates.tsx) so the frontend can merge official + community rows
 *  without a second type. */
export type MarketplaceTemplate = {
  id: string;
  slug: string;
  name: string;
  description: string;
  stage: string;
  tone: string;
  category: string;
  subject: string;
  body: string;
  tags: string[];
  submitterName: string | null;
  submitterUrl: string | null;
  featured: boolean;
  submittedAt: string;
};

export type MarketplaceSubmission = MarketplaceTemplate & {
  accountId: string | null;
  submitterEmail: string | null;
  status: "pending" | "approved" | "rejected";
  rejectionReason: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

const MAX_PENDING_PER_ACCOUNT = 5;

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "template"
  );
}

async function uniqueSlug(env: Env, name: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  let suffix = 1;
  while (
    await env.CHASA_DB.prepare(`SELECT 1 FROM marketplace_templates WHERE slug = ?`).bind(slug).first()
  ) {
    suffix += 1;
    slug = `${base}-${suffix}`;
  }
  return slug;
}

type Row = {
  id: string;
  account_id: string | null;
  slug: string;
  name: string;
  description: string;
  stage: string;
  tone: string;
  category: string;
  subject: string;
  body: string;
  tags: string | null;
  submitter_name: string | null;
  submitter_url: string | null;
  featured: number;
  submitter_email: string | null;
  status: string;
  rejection_reason: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === "string") : [];
  } catch {
    return [];
  }
}

function rowToTemplate(row: Row): MarketplaceTemplate {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    stage: row.stage,
    tone: row.tone,
    category: row.category,
    subject: row.subject,
    body: row.body,
    tags: parseTags(row.tags),
    submitterName: row.submitter_name,
    submitterUrl: row.submitter_url,
    featured: row.featured === 1,
    submittedAt: row.submitted_at,
  };
}

function rowToSubmission(row: Row): MarketplaceSubmission {
  return {
    ...rowToTemplate(row),
    accountId: row.account_id,
    submitterEmail: row.submitter_email,
    status: row.status as MarketplaceSubmission["status"],
    rejectionReason: row.rejection_reason,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
  };
}

export async function listApproved(env: Env, category?: string | null): Promise<MarketplaceTemplate[]> {
  const query = category
    ? `SELECT * FROM marketplace_templates WHERE status = 'approved' AND category = ? ORDER BY featured DESC, submitted_at DESC`
    : `SELECT * FROM marketplace_templates WHERE status = 'approved' ORDER BY featured DESC, submitted_at DESC`;
  const stmt = category ? env.CHASA_DB.prepare(query).bind(category) : env.CHASA_DB.prepare(query);
  const { results } = await stmt.all<Row>();
  return (results ?? []).map(rowToTemplate);
}

export async function getApprovedBySlug(env: Env, slug: string): Promise<MarketplaceTemplate | null> {
  const row = await env.CHASA_DB.prepare(
    `SELECT * FROM marketplace_templates WHERE slug = ? AND status = 'approved'`
  )
    .bind(slug)
    .first<Row>();
  return row ? rowToTemplate(row) : null;
}

async function countPendingForAccount(env: Env, accountId: string): Promise<number> {
  const row = await env.CHASA_DB.prepare(
    `SELECT COUNT(*) as c FROM marketplace_templates WHERE account_id = ? AND status = 'pending'`
  )
    .bind(accountId)
    .first<{ c: number }>();
  return Number(row?.c ?? 0);
}

export async function submitTemplate(
  env: Env,
  accountId: string | null,
  input: {
    name: string;
    description: string;
    stage: string;
    tone: string;
    category: string;
    subject: string;
    body: string;
    tags: string[];
    submitterName: string | null;
    submitterUrl: string | null;
    submitterEmail: string | null;
  }
): Promise<{ ok: true; id: string; slug: string } | { ok: false; error: string }> {
  if (accountId) {
    const pending = await countPendingForAccount(env, accountId);
    if (pending >= MAX_PENDING_PER_ACCOUNT) {
      return {
        ok: false,
        error: `You already have ${MAX_PENDING_PER_ACCOUNT} submissions awaiting review.`,
      };
    }
  }

  const id = crypto.randomUUID();
  const slug = await uniqueSlug(env, input.name);
  const now = new Date().toISOString();

  await env.CHASA_DB.prepare(
    `INSERT INTO marketplace_templates
       (id, account_id, slug, name, description, stage, tone, category, subject, body, tags, submitter_name, submitter_url, submitter_email, status, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
  )
    .bind(
      id,
      accountId,
      slug,
      input.name,
      input.description,
      input.stage,
      input.tone,
      input.category,
      input.subject,
      input.body,
      input.tags.length ? JSON.stringify(input.tags) : null,
      input.submitterName,
      input.submitterUrl,
      input.submitterEmail,
      now
    )
    .run();

  return { ok: true, id, slug };
}

export async function listPending(env: Env): Promise<MarketplaceSubmission[]> {
  const { results } = await env.CHASA_DB.prepare(
    `SELECT * FROM marketplace_templates WHERE status = 'pending' ORDER BY submitted_at ASC`
  ).all<Row>();
  return (results ?? []).map(rowToSubmission);
}

/** Only updates rows still `pending` — an already-decided submission can't be reviewed twice.
 *  `featured` only matters on approval; ignored (and left false) for rejections. */
export async function reviewSubmission(
  env: Env,
  id: string,
  decision: "approved" | "rejected",
  reviewedBy: string,
  opts: { rejectionReason?: string | null; featured?: boolean } = {}
): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = new Date().toISOString();
  const featured = decision === "approved" && opts.featured ? 1 : 0;
  const result = await env.CHASA_DB.prepare(
    `UPDATE marketplace_templates
     SET status = ?, reviewed_at = ?, reviewed_by = ?, rejection_reason = ?, featured = ?
     WHERE id = ? AND status = 'pending'`
  )
    .bind(decision, now, reviewedBy, opts.rejectionReason ?? null, featured, id)
    .run();

  if (!result.meta.changes) {
    return { ok: false, error: "Not found or already reviewed" };
  }
  return { ok: true };
}
