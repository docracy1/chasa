/** Central SEO config — used by generators and chrome. */

export const SITE_URL = "https://chasa.io";

export const SOCIAL = {
  linkedin: "https://www.linkedin.com/company/chasa-io",
  x: "https://x.com/chasaHQ",
};

/** Stable IndexNow key (file must exist at /{key}.txt containing this value). */
export const INDEXNOW_KEY = "chasa-indexnow-20260727";

/** Injected at build when set: GOOGLE_SITE_VERIFICATION=… npm run build */
export const GOOGLE_SITE_VERIFICATION = process.env.GOOGLE_SITE_VERIFICATION?.trim() || "";

/** Injected at build when set: BING_SITE_VERIFICATION=… npm run build */
export const BING_SITE_VERIFICATION = process.env.BING_SITE_VERIFICATION?.trim() || "";

/** Sitemap entries with explicit priority (others discovered from public/). */
export const SITEMAP_ROUTES = [
  { path: "/", priority: 1.0, changefreq: "weekly" },
  { path: "/app/", priority: 0.9, changefreq: "weekly" },
  { path: "/app/login", priority: 0.5, changefreq: "monthly" },
  { path: "/free-templates/", priority: 0.9, changefreq: "weekly" },
  { path: "/free-templates/download", priority: 0.85, changefreq: "monthly" },
  { path: "/ai", priority: 0.85, changefreq: "weekly" },
  { path: "/invoice-follow-up", priority: 0.85, changefreq: "monthly" },
  { path: "/payment-reminder", priority: 0.85, changefreq: "monthly" },
  { path: "/overdue-invoice", priority: 0.85, changefreq: "monthly" },
  { path: "/chase-invoices", priority: 0.85, changefreq: "monthly" },
  { path: "/freelancer-invoice-follow-up", priority: 0.85, changefreq: "monthly" },
  { path: "/tools/", priority: 0.9, changefreq: "weekly" },
  { path: "/tools/late-payment-calculator", priority: 0.9, changefreq: "monthly" },
  { path: "/tools/chase-savings-calculator", priority: 0.9, changefreq: "monthly" },
  { path: "/features/", priority: 0.8, changefreq: "monthly" },
  { path: "/features/ai-tone", priority: 0.75, changefreq: "monthly" },
  { path: "/features/templates", priority: 0.75, changefreq: "monthly" },
  { path: "/docs/", priority: 0.75, changefreq: "monthly" },
  { path: "/blog/", priority: 0.7, changefreq: "weekly" },
  { path: "/press", priority: 0.55, changefreq: "monthly" },
  { path: "/about", priority: 0.6, changefreq: "monthly" },
  { path: "/imprint", priority: 0.3, changefreq: "yearly" },
  { path: "/privacy", priority: 0.4, changefreq: "yearly" },
  { path: "/terms", priority: 0.4, changefreq: "yearly" },
];

export const ORG_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Chasa",
  url: SITE_URL,
  logo: `${SITE_URL}/brand/chasa-logo.svg`,
  sameAs: [SOCIAL.linkedin, SOCIAL.x],
  parentOrganization: {
    "@type": "Organization",
    name: "RELACON GmbH",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Vienna",
      addressCountry: "AT",
    },
  },
};
