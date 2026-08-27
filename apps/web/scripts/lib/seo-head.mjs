import { BING_SITE_VERIFICATION, GOOGLE_SITE_VERIFICATION, SOCIAL } from "../data/seo-config.mjs";

/** Meta tags + link rel for search verification, feeds, and social identity. */
export function renderSeoHead({ link = (p) => p } = {}) {
  const lines = [
    `<link rel="alternate" type="application/rss+xml" title="chasa Blog" href="${link("/blog/feed.xml")}">`,
    `<link rel="me" href="${SOCIAL.linkedin}">`,
    `<link rel="me" href="${SOCIAL.x}">`,
  ];
  if (GOOGLE_SITE_VERIFICATION) {
    lines.push(`<meta name="google-site-verification" content="${GOOGLE_SITE_VERIFICATION}">`);
  }
  if (BING_SITE_VERIFICATION) {
    lines.push(`<meta name="msvalidate.01" content="${BING_SITE_VERIFICATION}">`);
  }
  return lines.join("\n");
}
