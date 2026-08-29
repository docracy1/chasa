/**
 * The set of pages that have a REAL, statically-generated Spanish counterpart at /es/...
 * (as opposed to the client-side JS text-swap every other page still uses). Keyed by the
 * canonical EN path, valued by the canonical ES path.
 *
 * Used to: emit hreflang alternate tags, add /es/ URLs to the sitemap, and let the locale
 * switcher navigate to a real URL instead of just swapping text in place.
 *
 * Extend this list — and add the matching entry to ES_PAGES in generate-es-pages.mjs —
 * when a new page gets full Spanish coverage. Do NOT add a path here without also
 * generating the file, or hreflang/sitemap will point at a 404.
 */
export const EN_TO_ES = {
  "/": "/es/",
  "/#pricing": "/es/#pricing",
  "/#faq": "/es/#faq",
  "/invoice-follow-up": "/es/invoice-follow-up",
  "/chase-invoices": "/es/chase-invoices",
  "/payment-reminder": "/es/payment-reminder",
  "/guides/invoice-chasing/": "/es/guides/invoice-chasing/",
  "/privacy": "/es/privacy",
  "/terms": "/es/terms",
  "/blog/": "/es/blog/",
  // free-templates/index.html's body copy is hand-authored English with no data-i18n
  // coverage yet (only its chrome — header/footer — is i18n-driven). Add it here once
  // the page content itself is translatable, not before — a hreflang/sitemap entry
  // pointing at a page that's still mostly English would be worse than no entry.
};

export const ES_TO_EN = Object.fromEntries(Object.entries(EN_TO_ES).map(([en, es]) => [es, en]));

/** Only the page-level (non-anchor) pairs — what actually gets a generated file + hreflang tag. */
export const ES_PAGE_PAIRS = Object.entries(EN_TO_ES).filter(([en]) => !en.includes("#"));
