/** Content for /guides/invoice-chasing/ — topical silo hub (strategic SEO). */

export const HUB_STYLE = `<style>
  .guide-toc { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px 28px; margin-bottom: 32px; }
  .guide-toc h2 { font-size: 15px; font-weight: 700; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; }
  .guide-toc ol { margin: 0; padding-left: 20px; columns: 2; column-gap: 32px; }
  .guide-toc li { font-size: 14.5px; line-height: 1.9; }
  .guide-toc a { color: inherit; text-decoration: none; }
  .guide-toc a:hover { color: var(--accent, #F58025); }
  .guide-section { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; margin-bottom: 28px; }
  .guide-section h2 { font-size: 26px; font-weight: 700; margin: 0 0 14px; }
  .guide-section p { font-size: 15.5px; line-height: 1.7; color: #374151; margin: 0 0 14px; }
  .guide-section ul { font-size: 15.5px; line-height: 1.8; color: #374151; padding-left: 22px; margin: 0 0 14px; }
  .guide-related-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
  .guide-related-grid a { display: block; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; text-decoration: none; color: inherit; }
  .guide-related-grid a:hover { border-color: var(--accent, #F58025); }
  .guide-related-grid strong { display: block; font-size: 15px; color: #262626; }
  .guide-related-grid span { font-size: 13px; color: #6b7280; display: block; margin-top: 6px; }
  .guide-hero-lede { font-size: 18px; color: #4b5563; line-height: 1.6; max-width: 720px; }
  @media (max-width: 640px) { .guide-toc ol { columns: 1; } }
</style>`;

export const HUB_META = {
  title: "Invoice Chasing Hub — Templates, Guides & AI Drafts | docstoc",
  description:
    "Everything for chasing unpaid invoices: AI follow-up drafts, free email templates, escalation guides, calculators, and comparisons — one hub for freelancers and SMBs.",
  breadcrumb: "Invoice chasing hub",
};

export const HUB_FAQ = [
  {
    q: "Does docstoc send chase emails for me?",
    a: "No. docstoc drafts payment reminders and follow-ups — you review and send from your own inbox. Clients always hear from you.",
  },
  {
    q: "Where should I start if I have one overdue invoice?",
    a: "Paste the invoice in the app for a tone-matched draft, or copy a free template from the library. Match tone to days overdue: friendly first, firmer later.",
  },
  {
    q: "Is invoice chasing only part of docstoc?",
    a: "Yes — docstoc is the Trust Automation Layer: templates, invoicing, SSL, document certificates, and AI collections in one platform. This hub focuses on getting paid.",
  },
];

/** Invoice-chase blog slugs for the hub (must exist under /blog/). */
export const HUB_BLOG_SLUGS = [
  "how-to-follow-up-on-overdue-invoices",
  "invoice-payment-reminder-email-templates",
  "how-to-write-a-late-payment-email-that-gets-a-response",
  "how-to-ask-a-client-for-payment-without-sounding-desperate",
  "freelancer-late-payment-policy",
  "invoice-chase-software-comparison",
  "net-30-vs-net-60-payment-terms-for-freelancers",
];

export const HUB_MAIN = `<h1>Invoice chasing hub</h1>
  <p class="guide-hero-lede">Unpaid invoices, payment reminders, and follow-up emails — templates, guides, tools, and AI drafts in one place. Part of docstoc's Trust Automation Layer; you send every email yourself.</p>
  <p style="margin-top:20px"><a href="/app/login?start=1" class="nav-cta">Try the platform free →</a></p>

  <nav class="guide-toc" aria-label="Hub sections">
    <h2>On this hub</h2>
    <ol>
      <li><a href="#start">Start here</a></li>
      <li><a href="#landings">Follow-up &amp; reminder guides</a></li>
      <li><a href="#templates">Free email templates</a></li>
      <li><a href="#tools">Tools &amp; calculators</a></li>
      <li><a href="#blog">Blog guides</a></li>
      <li><a href="#compare">Compare chase tools</a></li>
    </ol>
  </nav>

  <section class="guide-section" id="start">
    <h2>Start here</h2>
    <p>New to docstoc? The app drafts tone-matched follow-ups from invoice details — 5 free AI drafts per month, no auto-send. Browse templates if you prefer copy-paste.</p>
    <ul>
      <li><a href="/app/">Open the platform</a> — paste an invoice, get a draft</li>
      <li><a href="/free-templates/">28 free payment reminder templates</a></li>
      <li><a href="/overdue-invoices-guide">Overdue invoices: the complete guide</a></li>
    </ul>
  </section>

  <section class="guide-section" id="landings">
    <h2>Follow-up &amp; reminder guides</h2>
    <div class="guide-related-grid">
      <a href="/invoice-follow-up"><strong>Invoice follow-up emails</strong><span>AI drafts matched to how late each payment is</span></a>
      <a href="/chase-invoices"><strong>Chase invoices</strong><span>Workflow without awkward wording or auto-send</span></a>
      <a href="/payment-reminder"><strong>Payment reminder emails</strong><span>Before and after the due date</span></a>
      <a href="/freelancer-invoice-follow-up"><strong>Freelancer follow-up guide</strong><span>Chasing as a solo operator</span></a>
      <a href="/overdue-invoice"><strong>Overdue invoice follow-up</strong><span>When an invoice is past due</span></a>
      <a href="/unpaid-invoice-follow-up-templates"><strong>Templates by stage</strong><span>12 copy-paste emails for every step</span></a>
    </div>
  </section>

  <section class="guide-section" id="templates">
    <h2>Free email templates</h2>
    <p>Copy-paste reminders for every stage — before due, gentle overdue, formal notice, final warning.</p>
    <ul>
      <li><a href="/free-templates/">Browse all 28 templates</a></li>
      <li><a href="/free-templates/payment-reminder-before-due-date">Payment reminder — 7 days before due</a></li>
      <li><a href="/free-templates/overdue-invoice-reminder-7-days">Overdue reminder — 7 days</a></li>
      <li><a href="/free-templates/formal-overdue-notice-30-days">Formal notice — 30 days</a></li>
    </ul>
  </section>

  <section class="guide-section" id="tools">
    <h2>Tools &amp; calculators</h2>
    <div class="guide-related-grid">
      <a href="/tools/invoice-chase-calculator"><strong>Invoice chase calculator</strong><span>Cost of late payments vs chasing time</span></a>
      <a href="/tools/invoice-generator"><strong>Invoice generator</strong><span>Create a shareable invoice, then chase it</span></a>
      <a href="/features/ai-tone"><strong>AI tone matching</strong><span>Friendly → professional → direct</span></a>
    </div>
  </section>

  <section class="guide-section" id="blog">
    <h2>Blog guides</h2>
    <div class="guide-related-grid">
      {{BLOG_LINKS}}
    </div>
  </section>

  <section class="guide-section" id="compare">
    <h2>Compare chase tools</h2>
    <p>docstoc drafts emails you send yourself — not auto-send collections software.</p>
    <ul>
      <li><a href="/docstoc-vs-chaser">docstoc vs Chaser</a></li>
      <li><a href="/docstoc-vs-paidnice">docstoc vs PaidNice</a></li>
      <li><a href="/docstoc-vs-chaseai">docstoc vs ChaseAI</a></li>
      <li><a href="/compare/">All comparisons</a></li>
    </ul>
  </section>

  <section class="guide-section" id="faq">
    <h2>FAQ</h2>
    {{FAQ}}
  </section>`;
