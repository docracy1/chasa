-- Blog posts (admin CMS → /blog, no redeploy)
CREATE TABLE blog_posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL COLLATE NOCASE,
  description TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT
);
CREATE INDEX idx_blog_posts_published ON blog_posts(published, published_at);

-- Aggregate page views (no visitor IDs / no IPs — country from CF header only)
CREATE TABLE page_views (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  day TEXT NOT NULL,
  is_bot INTEGER NOT NULL DEFAULT 0,
  bot_name TEXT,
  country TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_page_views_day ON page_views(day);
CREATE INDEX idx_page_views_path_day ON page_views(path, day);
