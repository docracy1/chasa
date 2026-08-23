import type { Env } from "../types";
import { type MarketplaceTemplate } from "./marketplaceTemplates";

export type TemplateKit = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  featured: boolean;
  createdAt: string;
};

type KitRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  featured: number;
  created_at: string;
};

function rowToKit(row: KitRow): TemplateKit {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    category: row.category,
    featured: row.featured === 1,
    createdAt: row.created_at,
  };
}

export async function listKits(env: Env): Promise<TemplateKit[]> {
  const { results } = await env.CHASA_DB.prepare(
    `SELECT * FROM template_kits ORDER BY featured DESC, created_at DESC`
  ).all<KitRow>();
  return (results ?? []).map(rowToKit);
}

export async function getKitBySlug(
  env: Env,
  slug: string
): Promise<{ kit: TemplateKit; templates: MarketplaceTemplate[] } | null> {
  const kitRow = await env.CHASA_DB.prepare(`SELECT * FROM template_kits WHERE slug = ?`)
    .bind(slug)
    .first<KitRow>();
  if (!kitRow) return null;

  const { results } = await env.CHASA_DB.prepare(
    `SELECT mt.* FROM marketplace_templates mt
     JOIN template_kit_items tki ON tki.template_id = mt.id
     WHERE tki.kit_id = ? AND mt.status = 'approved'
     ORDER BY tki.position ASC`
  )
    .bind(kitRow.id)
    .all();

  // Reuse marketplaceTemplates' row shape via a local require-free mapping — importing rowToTemplate
  // directly isn't exported, so map the fields we need here to avoid widening that module's surface
  // for a single cross-file helper.
  const templates = (results ?? []).map((row) => rowToMarketplaceRow(row as Record<string, unknown>));

  return { kit: rowToKit(kitRow), templates };
}

function rowToMarketplaceRow(row: Record<string, unknown>): MarketplaceTemplate {
  const tagsRaw = row.tags as string | null;
  let tags: string[] = [];
  if (tagsRaw) {
    try {
      const parsed = JSON.parse(tagsRaw);
      tags = Array.isArray(parsed) ? parsed.filter((t) => typeof t === "string") : [];
    } catch {
      tags = [];
    }
  }
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    description: row.description as string,
    stage: row.stage as string,
    tone: row.tone as string,
    category: row.category as string,
    templateType: row.template_type === "document" ? "document" : "email",
    subject: row.subject as string,
    body: row.body as string,
    bodyMarkdown: (row.body_markdown as string | null) ?? null,
    tags,
    submitterName: (row.submitter_name as string | null) ?? null,
    submitterUrl: (row.submitter_url as string | null) ?? null,
    featured: row.featured === 1,
    verifiedExpert: row.verified_expert === 1,
    expertCredential: (row.expert_credential as string | null) ?? null,
    submittedAt: row.submitted_at as string,
  };
}

/** Admin-only — kits are staff-curated, not community-submitted. */
export async function createKit(
  env: Env,
  input: { name: string; description: string; category: string }
): Promise<TemplateKit> {
  const id = crypto.randomUUID();
  const base = input.name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "kit";
  let slug = base;
  let suffix = 1;
  while (await env.CHASA_DB.prepare(`SELECT 1 FROM template_kits WHERE slug = ?`).bind(slug).first()) {
    suffix += 1;
    slug = `${base}-${suffix}`;
  }
  const now = new Date().toISOString();
  await env.CHASA_DB.prepare(
    `INSERT INTO template_kits (id, slug, name, description, category, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(id, slug, input.name, input.description, input.category, now)
    .run();
  return { id, slug, name: input.name, description: input.description, category: input.category, featured: false, createdAt: now };
}

export async function addItemToKit(env: Env, kitId: string, templateId: string, position = 0): Promise<void> {
  await env.CHASA_DB.prepare(
    `INSERT INTO template_kit_items (kit_id, template_id, position) VALUES (?, ?, ?)
     ON CONFLICT(kit_id, template_id) DO UPDATE SET position = excluded.position`
  )
    .bind(kitId, templateId, position)
    .run();
}
