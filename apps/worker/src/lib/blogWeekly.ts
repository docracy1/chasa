import type { Env } from "../types";
import { createPost, listPosts, updatePost, type BlogPost } from "./blog";
import { sanitizeJsonStringNewlines } from "./aiJson";

const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";
/** Kept for local `__scheduled?cron=` testing; production uses the daily cron + Monday check. */
export const BLOG_WEEKLY_CRON = "0 9 * * 1";

export function isWeeklyBlogMondayUtc(now = new Date()): boolean {
  return now.getUTCDay() === 1;
}

interface TopicRow {
  id: string;
  slug: string;
  title: string;
  angle: string;
  cluster: string;
  status: string;
}

interface DraftedPost {
  title: string;
  description: string;
  body: string;
  slug: string;
}

const SYSTEM_PROMPT = `
You write SEO blog posts for Chasa (chasa.io) — a free, no-signup AI invoice follow-up tool for
freelancers and small businesses. Paste an overdue invoice, Chasa drafts a tone-matched follow-up
email (warm at 1-7 days overdue, firmer at 30+). Users copy the draft and send it from their own
inbox — Chasa never sends on their behalf. Solo plan is a flat $7/mo per workspace (Pro $17/mo);
free tier works with no signup (18 templates + 5 AI drafts/month).

Respond with ONLY a JSON object — no markdown fences, no prose outside JSON:
{"title":"...","description":"...","body":"...","slug":"..."}

Rules:
- title: clear how-to or question style, under 70 characters, include the main keyword naturally
- description: meta description, 140-160 characters, compelling, includes keyword
- slug: lowercase kebab-case, 3-80 chars, match the title topic (letters, numbers, hyphens only)
- body: the FULL article as plain text using these markers only:
  - Lines starting with "## " for H2 section titles
  - Lines starting with "### " for FAQ questions
  - Blank line between paragraphs
  - Bullet lines starting with "- " for lists
- Structure like a strong competitor SEO guide: intro, what-is / why-it-matters sections,
  step-by-step or practical script, common mistakes list, FAQ (5-7 ### questions), short closing CTA
- Mention Chasa naturally; do not invent features. It drafts follow-up emails, it does not send them,
  and there's no accounting/invoicing feature — it's a chasing layer on top of whatever invoicing
  tool the reader already uses.
- Do NOT give legal, tax, or collections-enforceability advice — add a one-line disclaimer where relevant.
- Do NOT use **, *, # (except ## / ###), or HTML.
- Aim for roughly 900-1400 words of useful content.
`.trim();

function requireDb(env: Env) {
  if (!env.CHASA_DB) throw new Error("D1 is not configured on this deployment");
  return env.CHASA_DB;
}

function parseDraft(raw: string, fallback: TopicRow): DraftedPost | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(sanitizeJsonStringNewlines(match[0])) as Record<string, unknown>;
    const title = typeof parsed.title === "string" ? parsed.title.trim().slice(0, 120) : "";
    const description = typeof parsed.description === "string" ? parsed.description.trim().slice(0, 200) : "";
    const body = typeof parsed.body === "string" ? parsed.body.trim().slice(0, 20000) : "";
    const slugRaw = typeof parsed.slug === "string" && parsed.slug.trim() ? parsed.slug.trim() : fallback.slug;
    const slug =
      slugRaw
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || fallback.slug;
    if (!title || !body || body.length < 400) return null;
    return { title, description: description || title, body, slug };
  } catch {
    return null;
  }
}

async function draftFromTopic(env: Env, topic: TopicRow): Promise<DraftedPost | null> {
  try {
    const result = await env.AI.run((env.WORKERS_AI_MODEL || DEFAULT_MODEL) as keyof AiModels, {
      temperature: 0.45,
      max_tokens: 2800,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content:
            `Write the blog post for this queue item.\n` +
            `Suggested title: ${topic.title}\n` +
            `Preferred slug: ${topic.slug}\n` +
            `Cluster: ${topic.cluster}\n` +
            `Brief:\n${topic.angle}`,
        },
      ],
    });
    const raw = (result as { response?: string }).response?.trim();
    if (!raw) return null;
    return parseDraft(raw, topic);
  } catch (err) {
    console.error("Weekly blog AI draft failed:", err);
    return null;
  }
}

async function nextQueuedTopic(env: Env): Promise<TopicRow | null> {
  const db = requireDb(env);
  return (
    (await db
      .prepare(
        `SELECT id, slug, title, angle, cluster, status FROM blog_topic_queue
         WHERE status = 'queued' ORDER BY sort_order ASC, created_at ASC LIMIT 1`
      )
      .first<TopicRow>()) ?? null
  );
}

/** Prefer publishing an existing admin-authored draft; otherwise generate from the topic queue. */
async function publishOldestDraft(env: Env): Promise<string | null> {
  const drafts = (await listPosts(env, { publishedOnly: false })).filter((p: BlogPost) => !p.published);
  if (drafts.length === 0) return null;
  // listPosts sorts created_at DESC — the oldest draft is the last one in that order.
  const oldest = drafts[drafts.length - 1];
  const result = await updatePost(env, oldest.id, { published: true });
  if ("error" in result) return null;
  console.log(`Weekly blog: published existing draft ${oldest.slug}`);
  return oldest.slug;
}

async function markTopicPublished(env: Env, topicId: string, postId: string): Promise<void> {
  const db = requireDb(env);
  await db
    .prepare(
      `UPDATE blog_topic_queue SET status = 'published', published_post_id = ?, published_at = ? WHERE id = ?`
    )
    .bind(postId, new Date().toISOString(), topicId)
    .run();
}

/**
 * Monday job: publish one blog post.
 * 1) If an admin draft exists, publish the oldest.
 * 2) Else take the next queued SEO topic, draft with Workers AI, publish.
 * createPost() already appends a random suffix on slug collision, so no separate uniqueness check
 * is needed here the way Docracy's port required one.
 */
export async function runWeeklyBlogPublish(env: Env): Promise<void> {
  if (!env.CHASA_DB) {
    console.log("Weekly blog: skipped (no D1)");
    return;
  }

  const fromDraft = await publishOldestDraft(env);
  if (fromDraft) return;

  const topic = await nextQueuedTopic(env);
  if (!topic) {
    console.log("Weekly blog: no queued topics left");
    return;
  }

  const draft = await draftFromTopic(env, topic);
  if (!draft) {
    console.error(`Weekly blog: AI draft failed for topic ${topic.slug}`);
    return;
  }

  const created = await createPost(env, {
    title: draft.title,
    slug: draft.slug || topic.slug,
    description: draft.description,
    body: draft.body,
    published: true,
  });
  if ("error" in created) {
    console.error(`Weekly blog: create failed for ${draft.slug}: ${created.error}`);
    return;
  }

  await markTopicPublished(env, topic.id, created.id);
  console.log(`Weekly blog: published ${created.slug} from topic ${topic.id}`);
}

/** XML sitemap fragment listing published D1 posts, served live at /api/blog/sitemap.xml so a
 *  freshly-published Monday post is discoverable immediately, not just after the next full
 *  site rebuild bakes it into the static sitemap.xml. */
export async function blogPostsSitemapXml(env: Env): Promise<string> {
  const posts = await listPosts(env, { publishedOnly: true });
  const urls = posts
    .map((p) => {
      const lastmod = (p.publishedAt ?? p.createdAt).slice(0, 10);
      return `  <url>\n    <loc>https://chasa.io/blog/${p.slug}/</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
