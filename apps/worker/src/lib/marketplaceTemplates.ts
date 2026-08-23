import type { Env } from "../types";

export type TemplateType = "email" | "document";

/** Same shape as the static FreeChaseTemplate the app's Templates page already renders (see
 *  apps/web/app/src/pages/Templates.tsx) so the frontend can merge official + community rows
 *  without a second type. Document-type rows leave subject/body empty and use bodyMarkdown
 *  instead — kept as a discriminated field rather than a second table so admin review, rate
 *  limiting, and anonymous-submission handling stay in one place for both kinds. */
export type MarketplaceTemplate = {
  id: string;
  slug: string;
  name: string;
  description: string;
  stage: string;
  tone: string;
  category: string;
  templateType: TemplateType;
  subject: string;
  body: string;
  bodyMarkdown: string | null;
  tags: string[];
  submitterName: string | null;
  submitterUrl: string | null;
  featured: boolean;
  verifiedExpert: boolean;
  expertCredential: string | null;
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
  template_type: string;
  subject: string;
  body: string;
  body_markdown: string | null;
  tags: string | null;
  submitter_name: string | null;
  submitter_url: string | null;
  featured: number;
  verified_expert: number;
  expert_credential: string | null;
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
    templateType: row.template_type === "document" ? "document" : "email",
    subject: row.subject,
    body: row.body,
    bodyMarkdown: row.body_markdown,
    tags: parseTags(row.tags),
    submitterName: row.submitter_name,
    submitterUrl: row.submitter_url,
    featured: row.featured === 1,
    verifiedExpert: row.verified_expert === 1,
    expertCredential: row.expert_credential,
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

export async function listApproved(
  env: Env,
  category?: string | null,
  templateType?: TemplateType | null
): Promise<MarketplaceTemplate[]> {
  const conditions = ["status = 'approved'"];
  const binds: string[] = [];
  if (category) {
    conditions.push("category = ?");
    binds.push(category);
  }
  if (templateType) {
    conditions.push("template_type = ?");
    binds.push(templateType);
  }
  const query = `SELECT * FROM marketplace_templates WHERE ${conditions.join(" AND ")} ORDER BY featured DESC, submitted_at DESC`;
  const stmt = env.CHASA_DB.prepare(query).bind(...binds);
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
    templateType?: TemplateType;
    subject: string;
    body: string;
    bodyMarkdown?: string | null;
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
  const templateType: TemplateType = input.templateType === "document" ? "document" : "email";

  await env.CHASA_DB.prepare(
    `INSERT INTO marketplace_templates
       (id, account_id, slug, name, description, stage, tone, category, template_type, subject, body, body_markdown, tags, submitter_name, submitter_url, submitter_email, status, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
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
      templateType,
      input.subject,
      input.body,
      input.bodyMarkdown ?? null,
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
 *  `featured`/`verifiedExpert`/`expertCredential` only matter on approval; ignored (left
 *  false/null) for rejections — these are admin judgment calls, never submitter-supplied. */
export async function reviewSubmission(
  env: Env,
  id: string,
  decision: "approved" | "rejected",
  reviewedBy: string,
  opts: {
    rejectionReason?: string | null;
    featured?: boolean;
    verifiedExpert?: boolean;
    expertCredential?: string | null;
  } = {}
): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = new Date().toISOString();
  const approved = decision === "approved";
  const featured = approved && opts.featured ? 1 : 0;
  const verifiedExpert = approved && opts.verifiedExpert ? 1 : 0;
  const expertCredential = approved && opts.verifiedExpert ? opts.expertCredential ?? null : null;
  const result = await env.CHASA_DB.prepare(
    `UPDATE marketplace_templates
     SET status = ?, reviewed_at = ?, reviewed_by = ?, rejection_reason = ?, featured = ?, verified_expert = ?, expert_credential = ?
     WHERE id = ? AND status = 'pending'`
  )
    .bind(decision, now, reviewedBy, opts.rejectionReason ?? null, featured, verifiedExpert, expertCredential, id)
    .run();

  if (!result.meta.changes) {
    return { ok: false, error: "Not found or already reviewed" };
  }
  return { ok: true };
}
