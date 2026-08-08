/** Regeneratable marketing pages — main content is preserved via extraction. */

/** @type {Array<{ file: string; depth?: number; activeNav?: string; extraHead?: string }>} */
export const MARKETING_PAGES = [
  // SEO landings
  { file: "payment-reminder.html" },
  { file: "overdue-invoice.html" },
  { file: "invoice-follow-up.html" },
  { file: "freelancer-invoice-follow-up.html" },
  { file: "chase-invoices.html" },
  // Vs-competitor SEO landings (see generate-vs-pages.mjs)
  { file: "chasa-vs-chaser.html" },
  { file: "chasa-vs-paidnice.html" },
  { file: "chasa-vs-duefy.html" },
  { file: "chasa-vs-satago.html" },
  { file: "chasa-vs-chaseai.html" },
  // Features
  { file: "features/index.html", depth: 1, activeNav: "features" },
  { file: "features/templates.html", depth: 1, activeNav: "templates" },
  { file: "features/ai-tone.html", depth: 1, activeNav: "ai" },
  // Use Cases
  { file: "use-cases/index.html", depth: 1, activeNav: "use-cases" },
  { file: "use-cases/risk-scoring-automation.html", depth: 1, activeNav: "use-cases" },
  { file: "use-cases/audit-ready-workflows.html", depth: 1, activeNav: "use-cases" },
  { file: "use-cases/sox-evidence-automation.html", depth: 1, activeNav: "use-cases" },
  { file: "use-cases/compliance-dashboard.html", depth: 1, activeNav: "use-cases" },
  { file: "use-cases/chasa-certificate-monitoring.html", depth: 1, activeNav: "use-cases" },
  { file: "use-cases/document-signing-api.html", depth: 1, activeNav: "use-cases" },
  { file: "use-cases/flat-fee-esign.html", depth: 1, activeNav: "use-cases" },
  // Docs
  { file: "docs/index.html", depth: 1 },
  // About & legal
  { file: "about.html" },
  { file: "press.html" },
  { file: "privacy.html" },
  { file: "terms.html" },
  { file: "imprint.html" },
  // 404
  {
    file: "404.html",
    extraHead: `<style>
  .nf { padding: 80px 0 100px; text-align: center; }
  .nf h1 { font-family: Fraunces, Georgia, serif; font-size: clamp(40px, 6vw, 64px); margin: 12px 0 16px; }
  .nf p { color: var(--ink-soft); max-width: 420px; margin: 0 auto 28px; }
  .nf-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
  .nf-actions a.nav-cta { display: inline-flex; }
  .nf-ghost {
    display: inline-flex; align-items: center; padding: 10px 18px;
    border: 1px solid var(--line); border-radius: 8px; text-decoration: none;
    font-weight: 600; font-size: 14px;
  }
  .nf-code { font-family: Inter, sans-serif; font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); font-weight: 700; }
</style>`,
  },
];
