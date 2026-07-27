import type { Env } from "../types";

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  description: string;
  body: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "post";
}

function rowToPost(row: {
  id: string;
  title: string;
  slug: string;
  description: string;
  body: string;
  published: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}): BlogPost {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    body: row.body,
    published: row.published === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  };
}

export async function listPosts(env: Env, opts: { publishedOnly?: boolean } = {}): Promise<BlogPost[]> {
  const sql = opts.publishedOnly
    ? `SELECT * FROM blog_posts WHERE published = 1 ORDER BY COALESCE(published_at, created_at) DESC`
    : `SELECT * FROM blog_posts ORDER BY created_at DESC`;
  const res = await env.CHASA_DB.prepare(sql).all<{
    id: string;
    title: string;
    slug: string;
    description: string;
    body: string;
    published: number;
    created_at: string;
    updated_at: string;
    published_at: string | null;
  }>();
  return (res.results ?? []).map(rowToPost);
}

export async function getPostBySlug(env: Env, slug: string, publishedOnly = false): Promise<BlogPost | null> {
  const row = await env.CHASA_DB.prepare(
    publishedOnly
      ? `SELECT * FROM blog_posts WHERE slug = ? AND published = 1`
      : `SELECT * FROM blog_posts WHERE slug = ?`
  )
    .bind(slug)
    .first<{
      id: string;
      title: string;
      slug: string;
      description: string;
      body: string;
      published: number;
      created_at: string;
      updated_at: string;
      published_at: string | null;
    }>();
  return row ? rowToPost(row) : null;
}

export async function createPost(
  env: Env,
  input: { title: string; slug?: string; description?: string; body: string; published?: boolean }
): Promise<BlogPost | { error: string }> {
  const title = input.title.trim();
  if (!title) return { error: "Title is required." };
  const body = input.body.trim();
  if (!body) return { error: "Body is required." };

  let slug = (input.slug?.trim() ? slugify(input.slug) : slugify(title));
  const existing = await getPostBySlug(env, slug);
  if (existing) slug = `${slug}-${crypto.randomUUID().slice(0, 6)}`;

  const now = new Date().toISOString();
  const published = Boolean(input.published);
  const id = crypto.randomUUID();

  await env.CHASA_DB.prepare(
    `INSERT INTO blog_posts (id, title, slug, description, body, published, created_at, updated_at, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      title,
      slug,
      (input.description ?? "").trim(),
      body,
      published ? 1 : 0,
      now,
      now,
      published ? now : null
    )
    .run();

  const post = await getPostBySlug(env, slug);
  return post!;
}

export async function updatePost(
  env: Env,
  id: string,
  input: { title?: string; slug?: string; description?: string; body?: string; published?: boolean }
): Promise<BlogPost | { error: string }> {
  const current = await env.CHASA_DB.prepare(`SELECT * FROM blog_posts WHERE id = ?`)
    .bind(id)
    .first<{
      id: string;
      title: string;
      slug: string;
      description: string;
      body: string;
      published: number;
      created_at: string;
      updated_at: string;
      published_at: string | null;
    }>();
  if (!current) return { error: "Post not found." };

  const title = input.title?.trim() ?? current.title;
  const body = input.body?.trim() ?? current.body;
  const description = input.description !== undefined ? input.description.trim() : current.description;
  const slug = input.slug !== undefined ? slugify(input.slug || title) : current.slug;
  if (slug !== current.slug) {
    const clash = await getPostBySlug(env, slug);
    if (clash && clash.id !== id) return { error: "Slug already in use." };
  }

  const published = input.published !== undefined ? input.published : current.published === 1;
  const now = new Date().toISOString();
  let publishedAt = current.published_at;
  if (published && !publishedAt) publishedAt = now;
  if (!published) publishedAt = null;

  await env.CHASA_DB.prepare(
    `UPDATE blog_posts SET title = ?, slug = ?, description = ?, body = ?, published = ?, updated_at = ?, published_at = ?
     WHERE id = ?`
  )
    .bind(title, slug, description, body, published ? 1 : 0, now, publishedAt, id)
    .run();

  const post = await getPostBySlug(env, slug);
  return post!;
}

export async function deletePost(env: Env, id: string): Promise<void> {
  await env.CHASA_DB.prepare(`DELETE FROM blog_posts WHERE id = ?`).bind(id).run();
}
