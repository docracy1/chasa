import { Hono } from "hono";
import type { AuthEnv } from "../lib/auth";
import { getPostBySlug, listPosts } from "../lib/blog";

const blog = new Hono<AuthEnv>();

blog.get("/posts", async (c) => {
  const posts = await listPosts(c.env, { publishedOnly: true });
  return c.json({
    posts: posts.map((p) => ({
      title: p.title,
      slug: p.slug,
      description: p.description,
      publishedAt: p.publishedAt,
    })),
  });
});

blog.get("/posts/:slug", async (c) => {
  const post = await getPostBySlug(c.env, c.req.param("slug"), true);
  if (!post) return c.json({ error: "Not found" }, 404);
  return c.json({ post });
});

export default blog;
