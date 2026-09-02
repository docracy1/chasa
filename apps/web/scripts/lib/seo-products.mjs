/** Five core docstoc products — shared internal linking for SEO silos. */

export const CORE_PRODUCTS = [
  {
    path: "/document-templates/",
    label: "Document templates",
    desc: "1,000+ free business & legal documents",
  },
  {
    path: "/invoices",
    label: "Invoice generator",
    desc: "Create shareable invoices, then chase overdue ones",
  },
  {
    path: "/chase-invoices",
    label: "AI collections",
    desc: "Tone-matched invoice follow-up drafts",
  },
  {
    path: "/ssl",
    label: "SSL / TLS automation",
    desc: "Let's Encrypt for domains you control",
  },
  {
    path: "/certificate",
    label: "Document certificates",
    desc: "Tamper-evident hash verification for any file",
  },
];

/** Internal link block — reuse on template, chase, and product-adjacent pages. */
export function productsStripHtml() {
  const items = CORE_PRODUCTS.map(
    (p) =>
      `<a href="${p.path}"><strong>${p.label}</strong><span>${p.desc}</span></a>`
  ).join("\n    ");
  return `<section class="seo-products-strip" aria-label="docstoc products">
  <h2>Five products, one platform</h2>
  <div class="seo-products-grid">
    ${items}
  </div>
</section>`;
}

export const SEO_PRODUCTS_STRIP_STYLE = `<style>
  .seo-products-strip { margin: 40px 0 0; padding: 28px; border: 1px solid #e5e7eb; border-radius: 12px; background: #f9fafb; }
  .seo-products-strip h2 { font-size: 18px; font-weight: 700; margin: 0 0 16px; color: #262626; }
  .seo-products-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
  .seo-products-grid a { display: block; padding: 14px 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; text-decoration: none; color: inherit; }
  .seo-products-grid a:hover { border-color: var(--accent, #F58025); }
  .seo-products-grid strong { display: block; font-size: 14px; color: #262626; margin-bottom: 4px; }
  .seo-products-grid span { font-size: 12.5px; color: #6b7280; line-height: 1.4; }
</style>`;
