/**
 * SPA fallback for /app/* — Cloudflare's default "unknown path → /index.html"
 * was serving the marketing page for /app/login etc. Serve the React shell instead.
 */
export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  // Let real static files under /app (e.g. /app/index.html) through.
  if (url.pathname === "/app" || url.pathname === "/app/" || url.pathname === "/app/index.html") {
    return context.next();
  }
  if (url.pathname.includes(".")) {
    return context.next();
  }

  const assetUrl = new URL("/app/index.html", url.origin);
  return context.env.ASSETS.fetch(assetUrl);
};
