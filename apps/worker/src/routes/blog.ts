import { Hono } from "hono";
import type { AuthEnv } from "../lib/auth";
import { getPostBySlug, listPosts } from "../lib/blog";
import { blogPostsSitemapXml } from "../lib/blogWeekly";

const blog = new Hono<AuthEnv>();

/** Live sitemap for D1-backed posts (weekly-cron + admin-authored) — listed as a second Sitemap:
 *  line in robots.txt so a freshly-published Monday post is discoverable before the next full
 *  site rebuild bakes it into the static sitemap.xml. */
blog.get("/sitemap.xml", async (c) => {
  const xml = await blogPostsSitemapXml(c.env);
  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
});

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
