#!/usr/bin/env node
/**
 * Generates one dedicated "docstoc vs {Competitor}" SEO landing page per competitor, so each can
 * rank for its own "chasa vs X" / "X alternative" search query instead of sharing a section on
 * the single big /blog/invoice-chase-software-comparison/ post. Figures below are the same
 * vetted numbers already published on that post — not re-derived, just reused per-competitor.
 * Run: node apps/web/scripts/generate-vs-pages.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chrome, escapeHtml } from "./lib/chrome.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "../public");

/** @type {Array<{
 *  slug: string; name: string; pricingUrl: string; bestFit: string; entryPrice: string;
 *  pricingModel: string; autoSend: string; ownInbox: string; aiDrafts: string; toneAdjust: string;
 *  tracking: string; qboXero: string; sms: string; paymentPortal: string; freeTier: string;
 *  summary: string; faq: Array<{q: string; a: string}>;
 * }>} */
const COMPETITORS = [
  {
    slug: "chaser",
    blogLinked: true,
    name: "Chaser",
    pricingUrl: "https://www.chaserhq.com/chaser-pricing",
    bestFit: "SMB / mid-market AR",
    entryPrice: "From $259/mo",
    pricingModel: "Revenue tier + user caps",
    autoSend: "✓ auto-sends",
    ownInbox: "Optional / own-domain",
    aiDrafts: "Yes (AI assist)",
    toneAdjust: "Edit templates",
    tracking: "✓",
    qboXero: "✓",
    sms: "✓",
    paymentPortal: "✓",
    freeTier: "Trial",
    summary:
      "Chaser targets mid-market accounts-receivable teams with auto-send sequences, credit reporting, and a hosted payment portal — priced in revenue tiers starting around $259/mo. docstoc is built for the freelancer/small-team end of the market: a flat $9/mo, and every message stays a draft you send yourself instead of an automated collections domain emailing your clients.",
    faq: [
      {
        q: "Is docstoc a Chaser alternative?",
        a: "Yes for freelancers and small teams who want cheaper, draft-only follow-ups. Chaser targets SMB/mid-market AR with auto-send starting at a much higher price point.",
      },
      {
        q: "Does docstoc auto-send payment reminders like Chaser does?",
        a: "No. docstoc writes the email; you copy it into Gmail, Outlook, or Apple Mail (or open a mailto link). Clients always hear from you, not an automated system.",
      },
      {
        q: "How much cheaper is docstoc than Chaser?",
        a: "docstoc Pro is a flat $14.99/mo. Chaser's entry plan (Compact, up to 4 users) starts around $259/mo, and larger teams move to Chaser Core at roughly $779/mo — both revenue-tiered.",
      },
    ],
  },
  {
    slug: "paidnice",
    blogLinked: true,
    name: "Paidnice",
    pricingUrl: "https://www.paidnice.com/pricing",
    bestFit: "Xero / QuickBooks SMBs",
    entryPrice: "$69/mo",
    pricingModel: "Flat · seat cap on Essentials",
    autoSend: "✓ auto-sends",
    ownInbox: "Custom domain",
    aiDrafts: "Templates / rules",
    toneAdjust: "—",
    tracking: "✓",
    qboXero: "✓",
    sms: "✓",
    paymentPortal: "✓",
    freeTier: "Trial",
    summary:
      "Paidnice is Xero-native, adds UK late fees and statutory interest automatically, and starts at $69/mo flat with a seat cap on its entry plan. It's rule/template-based rather than AI-drafted, and it auto-sends. docstoc is $14.99/mo flat, writes an AI draft matched to how late each invoice is, and never sends anything without you reviewing it first.",
    faq: [
      {
        q: "Is docstoc a Paidnice alternative?",
        a: "If you want AI-written drafts and full control over what gets sent, yes. Paidnice is a strong fit if you specifically need automatic UK late fees and Xero-native automation — docstoc doesn't auto-charge late fees.",
      },
      {
        q: "Can docstoc replace Paidnice?",
        a: "If you need automatic UK statutory interest/late fees and full auto-send sequences, Paidnice may fit better. If you want AI drafts, tone controls, and inbox-first sending at a third of the price, docstoc is built for that.",
      },
      {
        q: "Does docstoc cost less than Paidnice?",
        a: "Yes — docstoc Pro is $14.99/mo flat. Paidnice starts at $69/mo for Essentials (up to 2 team members) or $99/mo for Pro (unlimited users).",
      },
    ],
  },
  {
    slug: "duefy",
    blogLinked: true,
    name: "Duefy",
    pricingUrl: "https://duefy.ai/",
    bestFit: "Solo & small teams",
    entryPrice: "$19/mo",
    pricingModel: "Plan tiers · Team +$/seat",
    autoSend: "✓ auto-sends",
    ownInbox: "Sends as you",
    aiDrafts: "✓",
    toneAdjust: "Tone escalation",
    tracking: "—",
    qboXero: "Integrations on paid",
    sms: "Pro+",
    paymentPortal: "✓",
    freeTier: "14-day trial",
    summary:
      "Duefy is the closest competitor in spirit — AI-written, tone-escalating reminders for solo operators and small teams — but it auto-sends on your behalf and starts at $19/mo (Solo), rising to $49/mo (Pro) or a per-seat Team plan. docstoc is $14.99/mo flat, keeps every send manual, and keeps flat per-workspace pricing on Business too.",
    faq: [
      {
        q: "Is docstoc a Duefy alternative?",
        a: "Yes, if the one thing you want to change is auto-send — Duefy sends chase emails automatically once scheduled; docstoc always leaves the send action to you, at roughly a third of Duefy Solo's price.",
      },
      {
        q: "How does docstoc pricing compare to Duefy?",
        a: "docstoc Pro is $14.99/mo flat. Duefy Solo is $19/mo, Duefy Pro is $49/mo, and Duefy Team starts at $99/mo plus $10 per extra seat past five.",
      },
      {
        q: "Does Duefy have tone escalation like docstoc?",
        a: "Both escalate tone as an invoice ages. docstoc's tone adjustment (soften/firm up/shorten) is a manual, per-draft control on paid plans; Duefy escalates automatically as part of its send schedule.",
      },
    ],
  },
  {
    slug: "satago",
    blogLinked: true,
    name: "Satago",
    pricingUrl: "https://www.satago.com/pricing/",
    bestFit: "UK credit control",
    entryPrice: "£45/mo (~$58)",
    pricingModel: "Flat plan tiers",
    autoSend: "✓ auto-sends",
    ownInbox: "Own email on Premium+",
    aiDrafts: "Templates",
    toneAdjust: "—",
    tracking: "—",
    qboXero: "✓",
    sms: "Premium+",
    paymentPortal: "Cards / BNPL",
    freeTier: "Trial",
    summary:
      "Satago adds Experian credit risk scoring and UK invoice finance on top of chasing — a genuinely different product aimed at UK credit control, not just reminder emails. It starts around £45/mo (~$58) and auto-sends from template rules. docstoc doesn't do credit checks or invoice finance; it's a $14.99/mo, AI-drafted, draft-only alternative for freelancers who just need the wording done.",
    faq: [
      {
        q: "Is docstoc a Satago alternative?",
        a: "For chasing specifically, yes — at a much lower price and without auto-send. If you need Experian credit checks or invoice finance, Satago covers ground docstoc doesn't touch at all.",
      },
      {
        q: "How much does Satago cost compared to docstoc?",
        a: "Satago Basic is about £45/mo (~$58), Satago Premium about £80/mo (~$102). docstoc Pro is $14.99/mo flat.",
      },
      {
        q: "Does docstoc offer invoice finance like Satago?",
        a: "No. docstoc focuses only on drafting payment follow-up emails — it doesn't offer credit scoring, invoice finance, or a payment portal.",
      },
    ],
  },
  {
    slug: "chaseai",
    blogLinked: true,
    name: "ChaseAI",
    pricingUrl: "https://chaseai.app/pricing",
    bestFit: "Freelancers (auto-send)",
    entryPrice: "$9/mo",
    pricingModel: "Flat workspace",
    autoSend: "✓ auto-sends",
    ownInbox: "Sends as you",
    aiDrafts: "✓",
    toneAdjust: "Tone options",
    tracking: "—",
    qboXero: "✗ PDF / manual",
    sms: "✗",
    paymentPortal: "✗",
    freeTier: "Free plan",
    summary:
      "ChaseAI now matches docstoc on price ($14.99/mo Pro, $39.99/mo Business) and also targets freelancers, but it's chasing-only: it auto-sends the AI draft on a schedule rather than handing it back to you first, and it has no native QuickBooks/Xero sync (PDF/manual import only). docstoc keeps every message draft-only, adds Pro+ OAuth sync to QuickBooks Online and Xero, and the same subscription also includes free business & legal document templates, document certification, and (on Business) free SSL automation for your own domain.",
    faq: [
      {
        q: "Is docstoc a ChaseAI alternative?",
        a: "Yes — both are built for freelancers at the same price, but ChaseAI auto-sends while docstoc always leaves the send action to you, and docstoc adds native QuickBooks/Xero sync plus document templates and certification that ChaseAI doesn't have.",
      },
      {
        q: "Is docstoc cheaper than ChaseAI?",
        a: "No — ChaseAI Starter is $9/mo; docstoc Pro is $14.99/mo (Business $39.99/mo). The difference is scope, not price: docstoc's subscription also covers native accounting sync, free document templates, and document certification, which ChaseAI's chasing-only product doesn't include.",
      },
      {
        q: "Does ChaseAI connect to QuickBooks or Xero?",
        a: "Not natively — ChaseAI relies on PDF or manual invoice import. docstoc has native OAuth sync to QuickBooks Online and Xero from Pro up.",
      },
    ],
  },
  {
    slug: "upflow",
    name: "Upflow",
    pricingUrl: "https://upflow.io/pricing",
    bestFit: "Mid-market / enterprise AR",
    entryPrice: "Custom (sales-led)",
    pricingModel: "ARR-tiered · contact sales",
    autoSend: "✓ auto-sends",
    ownInbox: "Not publicly disclosed",
    aiDrafts: "Templates (no AI drafting disclosed)",
    toneAdjust: "Manual tone control",
    tracking: "Aging/DSO analytics (no open/click tracking disclosed)",
    qboXero: "✓ (+ NetSuite, Sage Intacct)",
    sms: "Not disclosed",
    paymentPortal: "✓ branded portal",
    freeTier: `Free "Discover" tier (analytics only)`,
    summary:
      "Upflow targets mid-market and enterprise AR teams with automated multi-step reminder workflows and a branded payment portal, but every paid tier is sales-led — there's no public per-month price for Grow, Scale, or Strategic. docstoc is $14.99/mo flat, listed publicly, and never auto-sends: every AI draft waits for you to review and send it yourself.",
    faq: [
      {
        q: "Is docstoc an Upflow alternative?",
        a: "For freelancers and small teams, yes — docstoc is $14.99/mo flat with a public price, while Upflow is built for mid-market/enterprise AR and requires a sales call for pricing on every paid tier.",
      },
      {
        q: "Does Upflow publish its pricing?",
        a: "No. Upflow's Grow, Scale, and Strategic tiers are all \"contact sales,\" tiered by your company's ARR. docstoc Pro is a published $14.99/mo flat rate.",
      },
      {
        q: "Does docstoc auto-send reminders like Upflow?",
        a: "No. Upflow schedules multi-step reminder workflows automatically. docstoc always drafts the email and waits for you to send it — nothing goes out without your review.",
      },
    ],
  },
  {
    slug: "invoicesherpa",
    name: "InvoiceSherpa",
    pricingUrl: "https://www.invoicesherpa.com/pricing",
    bestFit: "SMBs on QuickBooks/Xero/Clio",
    entryPrice: "$49/mo (Sole Proprietor)",
    pricingModel: "Flat · tiered by open invoices",
    autoSend: "✓ auto-sends",
    ownInbox: "✓ domain-validated",
    aiDrafts: "Templates",
    toneAdjust: "—",
    tracking: "—",
    qboXero: "✓ (+ Clio)",
    sms: "✓ all plans",
    paymentPortal: "✓ + autopay",
    freeTier: "14-day trial",
    summary:
      "InvoiceSherpa auto-sends trigger-based reminders — due-soon, past-due, paid confirmation — from your own domain once validated, starting at $49/mo for up to 100 open invoices. It's template-based, not AI-drafted, and the wording doesn't change tone as an invoice gets later. docstoc is $14.99/mo flat, AI-drafts fresh wording matched to how overdue each invoice is, and leaves every send to you.",
    faq: [
      {
        q: "Is docstoc an InvoiceSherpa alternative?",
        a: "If you want AI-drafted wording and full control over what's sent, yes. InvoiceSherpa is a stronger fit if you specifically want fully automatic, trigger-based sending and SMS on every plan.",
      },
      {
        q: "Does docstoc cost less than InvoiceSherpa?",
        a: "Yes — docstoc Pro is $14.99/mo flat. InvoiceSherpa starts at $49/mo (or $41/mo billed annually) for up to 100 open invoices, and scales up from there by invoice volume.",
      },
      {
        q: "Does docstoc auto-send like InvoiceSherpa?",
        a: "No. InvoiceSherpa sends automatically once a trigger fires. docstoc writes the draft and waits for you to copy it in and send it yourself.",
      },
    ],
  },
  {
    slug: "gaviti",
    name: "Gaviti",
    pricingUrl: "https://gaviti.com/pricing/",
    bestFit: "Mid-market / enterprise AR",
    entryPrice: "Custom (sales-led)",
    pricingModel: "Usage-based · contact sales",
    autoSend: "✓ auto-sends",
    ownInbox: "Not publicly disclosed",
    aiDrafts: "✓ AI-generated",
    toneAdjust: "Not disclosed",
    tracking: "General dashboard tracking (no open/click specifics disclosed)",
    qboXero: "✓ (+ NetSuite, Sage Intacct)",
    sms: "✓ multi-channel",
    paymentPortal: "✓ zero-fee ACH",
    freeTier: "No trial — demo only",
    summary:
      "Gaviti is an enterprise AR platform with AI-generated collection emails and multi-channel (email, SMS, portal) chasing, priced per invoice volume with no public rate and no free trial — only a sales demo. docstoc is $14.99/mo flat with a published price, a free tier (5 AI drafts/month), and every message stays a draft until you send it.",
    faq: [
      {
        q: "Is docstoc a Gaviti alternative?",
        a: "For freelancers and small teams, yes — docstoc has a free tier and a published $14.99/mo price. Gaviti is built for enterprise AR teams and requires a sales demo, with no public pricing or free trial.",
      },
      {
        q: "Does Gaviti use AI like docstoc?",
        a: "Yes — Gaviti generates collection emails with AI, similar in spirit to docstoc. The difference is price and audience: Gaviti is quote-based for enterprise AR teams, docstoc is $14.99/mo flat for freelancers and small teams.",
      },
      {
        q: "Can I try Gaviti for free?",
        a: "No — Gaviti doesn't offer a free trial, only a sales demo. docstoc has a free tier (18 templates + 5 AI drafts/month) with no credit card required.",
      },
    ],
  },
  {
    slug: "yaypay",
    name: "Quadient AR",
    pricingUrl: "https://www.quadient.com/en/ar-automation",
    bestFit: "Regulated mid-market / enterprise finance teams",
    entryPrice: "~$500+/mo (reported, sales-led)",
    pricingModel: "Custom · contact sales",
    autoSend: "✓ auto-sends",
    ownInbox: "Not publicly disclosed",
    aiDrafts: "Rules + payment-behavior prediction (not drafting)",
    toneAdjust: "—",
    tracking: "Dashboard status (no open/click tracking disclosed)",
    qboXero: "✓ (+ SAP, NetSuite, Dynamics, Sage)",
    sms: "Not disclosed",
    paymentPortal: "✓ self-service portal",
    freeTier: "None disclosed",
    summary:
      "YayPay was acquired by Quadient and rebranded to Quadient Accounts Receivable in 2022. It targets regulated mid-market and enterprise finance teams with rule-based auto-send workflows, and its AI is focused on predicting payment behavior rather than writing the email itself. Pricing isn't public — third-party trackers report quotes starting around $500/mo. docstoc is $14.99/mo flat, published, and its AI drafts the actual wording of each follow-up.",
    faq: [
      {
        q: "Is YayPay still called YayPay?",
        a: `No — YayPay was acquired by Quadient in 2020 and formally rebranded to "Quadient Accounts Receivable" (Quadient AR) in November 2022. It's the same product and support team under a new name.`,
      },
      {
        q: "Is docstoc a Quadient AR / YayPay alternative?",
        a: "For freelancers and small teams, yes. Quadient AR targets regulated mid-market and enterprise finance teams with custom, sales-led pricing reported to start around $500/mo — a different market than docstoc's $14.99/mo flat plan.",
      },
      {
        q: "Does Quadient AR write AI drafts like docstoc?",
        a: "Not in the same sense — Quadient AR's AI is used to predict payment behavior and prioritize collections, not to draft the wording of each reminder. docstoc's AI writes the actual email, matched to how overdue the invoice is.",
      },
    ],
  },
  {
    slug: "freshbooks",
    name: "FreshBooks",
    pricingUrl: "https://www.freshbooks.com/pricing",
    bestFit: "Full invoicing / accounting suite",
    entryPrice: "$23/mo (Lite)",
    pricingModel: "Flat tiers",
    autoSend: "✓ auto-sends",
    ownInbox: "FreshBooks-hosted (branded)",
    aiDrafts: "Fixed / customizable templates",
    toneAdjust: "—",
    tracking: "Invoice view status (not reminder-specific)",
    qboXero: "✗ own accounting suite",
    sms: "—",
    paymentPortal: "✓ via FreshBooks Payments",
    freeTier: "30-day trial (no free plan)",
    summary:
      "FreshBooks is a full accounting suite — invoicing, time tracking, expenses, double-entry books — with automated late-payment reminders bundled into every paid tier starting at $23/mo. Reminders are fixed templates sent through FreshBooks' own system, not AI-drafted or matched to how late an invoice is. docstoc doesn't do accounting at all; it's a $14.99/mo, AI-drafted follow-up layer you can run alongside FreshBooks or any invoicing tool you already use.",
    faq: [
      {
        q: "Is docstoc a FreshBooks alternative?",
        a: "Not for accounting — docstoc doesn't invoice, track time, or do bookkeeping. For the specific job of writing overdue-payment follow-ups, docstoc's AI drafts wording matched to lateness; FreshBooks sends one fixed template regardless of how overdue an invoice is.",
      },
      {
        q: "Can I use docstoc alongside FreshBooks?",
        a: "Yes. docstoc isn't an accounting suite — it's built to sit on top of whatever invoicing tool you already use, including FreshBooks, and draft the follow-up email when a client goes quiet.",
      },
      {
        q: "Does FreshBooks have a free plan?",
        a: "No — FreshBooks only offers a 30-day trial, then requires a paid plan starting at $23/mo. docstoc has an ongoing free tier: 18 templates plus 5 AI drafts per month.",
      },
    ],
  },
  {
    slug: "wave",
    name: "Wave",
    pricingUrl: "https://www.waveapps.com/pricing",
    bestFit: "Free invoicing suite",
    entryPrice: "$19/mo (Pro) — reminders need Payments or Pro",
    pricingModel: "Free suite + $19/mo Pro",
    autoSend: "✓ auto-sends (3/7/14 days)",
    ownInbox: "Wave-hosted",
    aiDrafts: "Fixed template",
    toneAdjust: "—",
    tracking: "Invoice view status",
    qboXero: "✗ own accounting suite",
    sms: "—",
    paymentPortal: "✓ via Wave Payments",
    freeTier: "✓ free invoicing (reminders gated)",
    summary:
      "Wave's core invoicing is genuinely free, but automated payment reminders only unlock once you enable Wave Payments or upgrade to Pro ($19/mo) — and even then it's one fixed template on a fixed 3/7/14-day schedule, not AI-written or escalating in tone. docstoc adds AI-drafted, lateness-matched wording for $14.99/mo on top of whatever invoicing tool you use, including Wave.",
    faq: [
      {
        q: "Is docstoc a Wave alternative?",
        a: "Not for invoicing — Wave's free invoicing suite is hard to beat on price. For overdue-payment follow-ups specifically, Wave's free tier doesn't include reminders at all; docstoc gives you AI-drafted, lateness-matched wording starting at a free tier of its own.",
      },
      {
        q: "Does Wave's free plan include payment reminders?",
        a: "No — on Wave, automated reminders require either enabling Wave Payments or upgrading to Pro at $19/mo. docstoc's free tier includes 18 templates and 5 AI drafts per month with no payment processor required.",
      },
      {
        q: "Can I use docstoc with Wave?",
        a: "Yes. docstoc isn't an invoicing tool — it drafts the follow-up email for whatever invoice you paste in, whether it came from Wave or anywhere else.",
      },
    ],
  },
  {
    slug: "zoho-invoice",
    name: "Zoho Invoice",
    pricingUrl: "https://www.zoho.com/us/invoice/pricing/",
    bestFit: "Free invoicing suite",
    entryPrice: "Free (no paid tier)",
    pricingModel: "Free — no paid plan",
    autoSend: "✓ auto-sends",
    ownInbox: "Not publicly disclosed",
    aiDrafts: "Templates with merge fields",
    toneAdjust: "—",
    tracking: "—",
    qboXero: "✗ own accounting suite",
    sms: "—",
    paymentPortal: "✓ client portal",
    freeTier: "✓ fully free (2 users, 500 invoices/yr)",
    summary:
      "Zoho Invoice is entirely free — there's no paid tier at all — and includes scheduled, template-based reminders with merge fields, capped at 500 invoices/year and 2 users, with \"Powered by Zoho\" branding. Reminders aren't AI-drafted or adjusted in tone for how overdue an invoice is. docstoc adds that AI-drafted, lateness-matched layer for $14.99/mo once you outgrow fixed templates.",
    faq: [
      {
        q: "Is docstoc a Zoho Invoice alternative?",
        a: "Not for invoicing — Zoho Invoice is free and full-featured for creating invoices. For the follow-up wording specifically, Zoho sends the same template regardless of lateness; docstoc's AI drafts fresh wording matched to how overdue each invoice is.",
      },
      {
        q: "Does Zoho Invoice have a paid plan?",
        a: "No — Zoho Invoice has no paid tier; it's free with limits (2 users, 500 invoices/year, Zoho branding). docstoc's paid plans start at $14.99/mo and remove docstoc's own limits on AI drafts.",
      },
      {
        q: "Can I use docstoc alongside Zoho Invoice?",
        a: "Yes. docstoc doesn't create invoices — it drafts the follow-up email once one goes overdue, regardless of which invoicing tool you used to send it.",
      },
    ],
  },
  {
    slug: "quickbooks",
    name: "QuickBooks Online",
    pricingUrl: "https://quickbooks.intuit.com/pricing/",
    bestFit: "Full accounting suite",
    entryPrice: "$38/mo (Simple Start)",
    pricingModel: "Flat tiers",
    autoSend: "✓ auto-sends",
    ownInbox: "Intuit no-reply (yours is reply-to only)",
    aiDrafts: "Fixed template",
    toneAdjust: "—",
    tracking: `Invoice "Viewed" status (not reminder-specific)`,
    qboXero: "— it is QuickBooks; docstoc syncs to it ✓ Pro+",
    sms: "✗",
    paymentPortal: "✓ via QuickBooks Payments",
    freeTier: "30-day trial (no free plan)",
    summary:
      "QuickBooks Online auto-sends up to three scheduled reminders per invoice, but from an Intuit no-reply address — your email is only the reply-to — with one static template regardless of how late the invoice is. docstoc connects to your QuickBooks Online account by OAuth (Pro+), drafts fresh wording matched to how overdue each invoice is, and sends from your own inbox.",
    faq: [
      {
        q: "Is docstoc a QuickBooks Online alternative?",
        a: "Not for accounting — docstoc doesn't replace QuickBooks. docstoc connects to your existing QuickBooks Online account and adds AI-drafted, lateness-matched follow-up wording that QuickBooks' own fixed-template reminders don't have.",
      },
      {
        q: "Do QuickBooks payment reminders come from my own email address?",
        a: "No — QuickBooks Online sends reminders from an Intuit no-reply address, with your business email set only as the reply-to. docstoc's drafts are written for you to send from your own inbox directly.",
      },
      {
        q: "Does docstoc sync with QuickBooks Online?",
        a: "Yes — docstoc has native OAuth sync to QuickBooks Online from the Pro plan up, so you can pull invoices in and draft AI follow-ups without re-entering data.",
      },
    ],
  },
  {
    slug: "xero",
    name: "Xero",
    pricingUrl: "https://www.xero.com/us/pricing-plans/",
    bestFit: "Full accounting suite",
    entryPrice: "$25/mo (Early)",
    pricingModel: "Flat tiers",
    autoSend: "✓ auto-sends (default 7/14/21 days)",
    ownInbox: "noreply@xero.com (yours is reply-to only)",
    aiDrafts: "Fixed template with merge fields",
    toneAdjust: "—",
    tracking: "—",
    qboXero: "— it is Xero; docstoc syncs to it ✓ Pro+",
    sms: "✗ manual only, no automated sequence",
    paymentPortal: "Via connected payment services",
    freeTier: "30-day trial (no free plan)",
    summary:
      "Xero auto-sends reminders on a default 7/14/21-day schedule from noreply@xero.com — not your own address — using an editable template that doesn't change tone as an invoice ages. docstoc connects to your Xero account by OAuth (Pro+), drafts fresh wording matched to how overdue each invoice is, and sends from your own inbox.",
    faq: [
      {
        q: "Is docstoc a Xero alternative?",
        a: "Not for accounting — docstoc doesn't replace Xero. docstoc connects to your existing Xero account and adds AI-drafted, lateness-matched follow-up wording that Xero's own fixed-template reminders don't have.",
      },
      {
        q: "Do Xero payment reminders come from my own email address?",
        a: "No — Xero sends reminders from noreply@xero.com, with your email set only as the reply-to, which some inboxes flag as a deliverability risk. docstoc's drafts are written for you to send from your own inbox directly.",
      },
      {
        q: "Does docstoc sync with Xero?",
        a: "Yes — docstoc has native OAuth sync to Xero from the Pro plan up, so you can pull invoices in and draft AI follow-ups without re-entering data.",
      },
    ],
  },
  {
    slug: "zervant",
    name: "Zervant",
    pricingUrl: "https://www.zervant.com/en/pricing/",
    bestFit: "EU freelancers / small business invoicing",
    entryPrice: "£10.99/mo (Starter)",
    pricingModel: "Flat tiers",
    autoSend: "✓ auto + manual",
    ownInbox: "Not publicly disclosed",
    aiDrafts: "Scheduled templates",
    toneAdjust: "—",
    tracking: "—",
    qboXero: "✗ own invoicing suite",
    sms: "—",
    paymentPortal: "Not publicly disclosed",
    freeTier: "✓ free plan (reminders need Starter+)",
    summary:
      "Zervant is an EU invoicing tool (part of the Ageras group); free-tier users don't get payment reminders at all — that requires the Starter plan (£10.99/mo) and up, and reminders are scheduled templates rather than AI-written. docstoc is EU-based and EU-hosted too, adds AI-drafted, lateness-matched wording for $14.99/mo, and works alongside whatever invoicing tool you already use.",
    faq: [
      {
        q: "Is docstoc a Zervant alternative?",
        a: "Not for invoicing — for the follow-up wording specifically, Zervant's free plan has no reminders at all, and paid reminders are fixed schedules. docstoc's free tier includes AI-drafted follow-ups from day one.",
      },
      {
        q: "Is docstoc EU-based like Zervant?",
        a: "Yes — docstoc is built and hosted in the EU (RELACON GmbH, Austria), the same regional footprint as Zervant.",
      },
      {
        q: "Can I use docstoc alongside Zervant?",
        a: "Yes. docstoc doesn't create invoices — paste a Zervant invoice's details in and docstoc drafts the follow-up email matched to how overdue it is.",
      },
    ],
  },
  {
    slug: "billomat",
    name: "Billomat",
    pricingUrl: "https://www.billomat.com/",
    bestFit: "German / EU invoicing + dunning",
    entryPrice: "€29/mo (Professional)",
    pricingModel: "Flat tiers",
    autoSend: "✓ auto / semi / manual modes",
    ownInbox: "Not publicly disclosed",
    aiDrafts: "Fixed dunning-stage templates",
    toneAdjust: "—",
    tracking: "—",
    qboXero: "✗ own invoicing suite",
    sms: "—",
    paymentPortal: "Not publicly disclosed",
    freeTier: "14-day trial (no free plan)",
    summary:
      "Billomat (by aifinyo AG) handles German-style dunning (Mahnwesen) with escalating fixed stages, but full automation only unlocks on the Business tier and up — there's no free plan, only a 14-day trial. It's template/stage-based, not AI-written or matched dynamically to how late an invoice is. docstoc is $14.99/mo flat with a free tier, AI-drafts fresh wording for each stage of lateness, and always leaves the send to you.",
    faq: [
      {
        q: "Is docstoc a Billomat alternative?",
        a: "Not for invoicing — for follow-up wording specifically, Billomat's dunning stages are fixed templates and full automation needs the Business tier. docstoc's AI drafts fresh wording matched to lateness on a $14.99/mo flat plan with a free tier included.",
      },
      {
        q: "Does Billomat have a free plan?",
        a: "No — Billomat offers only a 14-day trial, then requires a paid plan starting at €29/mo. docstoc has an ongoing free tier: 18 templates plus 5 AI drafts per month.",
      },
      {
        q: "Can I use docstoc alongside Billomat?",
        a: "Yes. docstoc doesn't create invoices or handle dunning fees — it drafts the follow-up email itself, which you can send alongside whatever invoicing or dunning tool you already use.",
      },
    ],
  },
];

function buildJsonLd(c) {
  return JSON.stringify(
    {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://chasa.io/" },
            {
              "@type": "ListItem",
              position: 2,
              name: `docstoc vs ${c.name}`,
              item: `https://chasa.io/chasa-vs-${c.slug}`,
            },
          ],
        },
        {
          "@type": "FAQPage",
          mainEntity: c.faq.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        },
      ],
    },
    null,
    2
  );
}

function buildMain(c) {
  const title = `docstoc vs ${c.name}`;
  const rows = [
    ["Best fit", "Freelancers & small teams", c.bestFit],
    ["Entry paid price", "$14.99/mo Pro", c.entryPrice],
    ["Pricing model", "Flat workspace", c.pricingModel],
    ["Auto-sends chase emails", "✗ draft only", c.autoSend],
    ["You send from your inbox", "✓", c.ownInbox],
    ["AI-written drafts", "✓", c.aiDrafts],
    ["Soften / firm / shorten", "✓ paid", c.toneAdjust],
    ["Open / click tracking", "✓ Pro+ tracked HTML", c.tracking],
    ["Native QuickBooks / Xero sync", "✓ Pro+ OAuth", c.qboXero],
    ["SMS reminders", "✓ Pro+ drafts only", c.sms],
    ["Client payment portal", "✗ your pay link in drafts", c.paymentPortal],
    ["Free tier", "18 templates + 5 AI drafts", c.freeTier],
  ];

  const tableRows = rows
    .map(
      ([label, chasaVal, otherVal]) =>
        `          <tr>
            <td>${escapeHtml(label)}</td>
            <td class="col-chasa">${chasaVal}</td>
            <td>${escapeHtml(otherVal)}</td>
          </tr>`
    )
    .join("\n");

  const faqHtml = c.faq
    .map(
      (item) =>
        `<details class="faq-item"><summary>${escapeHtml(item.q)}</summary>\n<p>${escapeHtml(item.a)}</p>\n</details>`
    )
    .join("\n");

  return `<p class="crumb"><a href="/">Home</a> / ${escapeHtml(title)}</p>
<h1>${escapeHtml(title)} — which invoice chase tool fits?</h1>
  <p class="lede">${c.summary}</p>

  <h2>docstoc vs ${escapeHtml(c.name)} at a glance</h2>
  <div class="compare-table-wrap">
    <table class="compare-table">
      <thead>
        <tr>
          <th scope="col"></th>
          <th scope="col" class="col-chasa">docstoc</th>
          <th scope="col">${escapeHtml(c.name)}</th>
        </tr>
      </thead>
      <tbody>
${tableRows}
      </tbody>
    </table>
  </div>
  <p class="pc-note">${
    c.blogLinked
      ? `Figures are the same published-price comparison as <a href="/blog/invoice-chase-software-comparison/">the full docstoc vs Chaser, Paidnice, Duefy, Satago &amp; ChaseAI comparison</a> — check`
      : `Figures reflect publicly available pricing and feature information as of August 2026 — check`
  } <a href="${c.pricingUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(c.name)}'s pricing page</a> directly before you buy, as plans change.</p>

  <p style="margin-top:28px"><a href="/app/" class="nav-cta">Try docstoc free</a></p>

  <h2>FAQ</h2>
  ${faqHtml}`;
}

mkdirSync(publicDir, { recursive: true });

for (const c of COMPETITORS) {
  const slug = `chasa-vs-${c.slug}`;
  const title = `docstoc vs ${c.name} — Which Invoice Chase Tool Fits? | docstoc`;
  const description = `docstoc vs ${c.name}: price, auto-send vs draft-only, AI drafts, and tracking compared side by side — pick the right invoice chase tool for a freelancer or small team.`;

  const html = chrome({
    title,
    description,
    canonical: `/${slug}`,
    activeNav: "",
    mainHtml: buildMain(c),
    jsonLd: buildJsonLd(c),
    depth: 0,
  });

  writeFileSync(join(publicDir, `${slug}.html`), html, "utf8");
  console.log(`Generated ${slug}.html`);
}

console.log(`Done — ${COMPETITORS.length} vs-competitor pages.`);
