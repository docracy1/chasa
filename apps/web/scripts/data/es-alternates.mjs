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
  "/privacy": "/es/privacy",
  "/terms": "/es/terms",
  "/free-templates/": "/es/free-templates/",
  "/blog/": "/es/blog/",
};

export const ES_TO_EN = Object.fromEntries(Object.entries(EN_TO_ES).map(([en, es]) => [es, en]));

/** Only the page-level (non-anchor) pairs — what actually gets a generated file + hreflang tag. */
export const ES_PAGE_PAIRS = Object.entries(EN_TO_ES).filter(([en]) => !en.includes("#"));
