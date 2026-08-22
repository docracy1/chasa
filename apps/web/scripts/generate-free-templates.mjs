#!/usr/bin/env node
/**
 * Generates /free-templates/index.html + one SEO page per template.
 * Run from repo root: node apps/web/scripts/generate-free-templates.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chrome, escapeHtml, trustBadgesHtml, conversionSectionHtml } from "./lib/chrome.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../public/free-templates");
const ASSET_V = "20260804k";

/** Category order controls both the "Categories" jump menu and section order on the page. */
const CATEGORIES = [
  "Freelancer",
  "Agency",
  "Corporate",
  "Legal",
  "Ghosted client",
  "Before due",
  "Due & early overdue",
  "Overdue follow-ups",
  "Formal notices",
  "Disputes",
  "Payments received",
];

/** @type {Array<{
 *  slug: string;
 *  name: string;
 *  seoTitle: string;
 *  description: string;
 *  stage: string;
 *  tone: string;
 *  category: string;
 *  subject: string;
 *  body: string;
 * }>} */
const TEMPLATES = [
  {
    slug: "payment-reminder-before-due-date",
    name: "Payment reminder — 7 days before due",
    seoTitle: "Free Payment Reminder Template (Before Due Date)",
    description:
      "Free pre-due payment reminder email template. Confirm the invoice arrived and put the due date on your client's calendar — no awkward chase yet.",
    stage: "7 days before due",
    tone: "Warm",
    category: "Before due",
    subject: "Invoice [Invoice #] due [Due date]",
    body: `Hi [Client name],

Quick note that invoice [Invoice #] for [Amount] is due on [Due date].

I've attached a copy in case it's useful. If anything looks off, reply and I'll sort it before the due date.

Thanks,
[Your name]`,
  },
  {
    slug: "invoice-due-today-reminder",
    name: "Invoice due today",
    seoTitle: "Free Invoice Due Today Email Template",
    description:
      "Free email template for the day an invoice is due. A clear, friendly nudge with the amount, due date, and an easy way to pay.",
    stage: "Due date",
    tone: "Friendly",
    category: "Due & early overdue",
    subject: "Invoice [Invoice #] is due today — [Amount]",
    body: `Hi [Client name],

Friendly reminder that invoice [Invoice #] for [Amount] is due today ([Due date]).

You can pay here: [Payment link or bank details]
I've attached the invoice again for convenience.

Appreciate it,
[Your name]`,
  },
  {
    slug: "gentle-overdue-invoice-reminder",
    name: "Gentle first reminder — 1–3 days overdue",
    seoTitle: "Free Gentle Overdue Invoice Email Template",
    description:
      "Free polite overdue invoice email template for 1–3 days late. Assumes an oversight, asks for a payment date, no blame.",
    stage: "1–3 days overdue",
    tone: "Polite",
    category: "Due & early overdue",
    subject: "Quick check-in on invoice [Invoice #]",
    body: `Hi [Client name],

I noticed invoice [Invoice #] for [Amount] (due [Due date]) hasn't cleared yet — it may have crossed with your payment run.

Could you let me know when payment is scheduled? Invoice attached; pay here if helpful: [Payment link].

Thanks,
[Your name]`,
  },
  {
    slug: "overdue-invoice-reminder-7-days",
    name: "Second reminder — 7 days overdue",
    seoTitle: "Free 7-Day Overdue Invoice Reminder Email Template",
    description:
      "Free firm-but-respectful email template for invoices 7 days overdue. Restates the balance and asks for a clear payment date.",
    stage: "7 days overdue",
    tone: "Firm",
    category: "Overdue follow-ups",
    subject: "Invoice [Invoice #] is 7 days overdue — [Amount]",
    body: `Hi [Client name],

Invoice [Invoice #] for [Amount] was due on [Due date] and is now 7 days overdue.

Please confirm when we can expect payment, or flag if there's an issue with the invoice so I can fix it. Copy attached — pay here: [Payment link].

Best,
[Your name]`,
  },
  {
    slug: "payment-plan-offer-overdue-invoice",
    name: "Payment plan offer — 14 days overdue",
    seoTitle: "Free Payment Plan Offer Email Template",
    description:
      "Free email template offering a short payment plan when an invoice is about 14 days overdue. Keeps the relationship intact while recovering cash.",
    stage: "14 days overdue",
    tone: "Empathetic",
    category: "Overdue follow-ups",
    subject: "Invoice [Invoice #] overdue — can we set a plan?",
    body: `Hi [Client name],

Invoice [Invoice #] for [Amount] (due [Due date]) is now 14 days overdue, and I haven't heard back.

If paying in full this week is tight, I'm happy to set up a short payment plan. Tell me what works and I'll confirm in writing.

Otherwise you can settle here: [Payment link]. Invoice attached.

Thanks,
[Your name]`,
  },
  {
    slug: "formal-overdue-notice-30-days",
    name: "Formal notice — 30 days overdue",
    seoTitle: "Free Formal Overdue Notice Template (30 Days)",
    description:
      "Free formal payment notice template for invoices 30 days overdue. Summarizes the facts and sets a firm new payment deadline.",
    stage: "30 days overdue",
    tone: "Formal",
    category: "Formal notices",
    subject: "Formal notice: invoice [Invoice #] — 30 days overdue",
    body: `Dear [Client name],

This is a formal notice regarding invoice [Invoice #] for [Amount], originally due [Due date]. The balance remains unpaid and is now 30 days overdue.

Please arrange payment by [New deadline date]. If payment is already in progress, reply with the expected arrival date.

Invoice attached. Payment details: [Payment link or bank details].

Regards,
[Your name]
[Your company]`,
  },
  {
    slug: "second-formal-notice-60-days",
    name: "Second formal notice — 60 days overdue",
    seoTitle: "Free 60-Day Overdue Invoice Formal Notice Template",
    description:
      "Free serious formal notice email template for invoices around 60 days overdue. States consequences clearly and firmly, without unnecessary drama.",
    stage: "60 days overdue",
    tone: "Serious",
    category: "Formal notices",
    subject: "Second notice: invoice [Invoice #] — 60 days overdue",
    body: `Dear [Client name],

Invoice [Invoice #] for [Amount] (due [Due date]) remains unpaid at 60 days overdue despite earlier reminders.

Please settle the full balance by [Final internal deadline]. If we do not receive payment or a written payment plan by that date, we will need to pause further work and consider next collection steps.

Pay here: [Payment link]. Invoice attached.

Regards,
[Your name]
[Your company]`,
  },
  {
    slug: "final-notice-before-collections",
    name: "Final notice before collections — 90 days",
    seoTitle: "Free Final Notice Before Collections Email Template",
    description:
      "Free final-notice email template before escalating to collections. Clear last chance with amount, due date, and deadline.",
    stage: "90 days overdue",
    tone: "Final",
    category: "Formal notices",
    subject: "Final notice: invoice [Invoice #] before collections",
    body: `Dear [Client name],

This is a final notice for invoice [Invoice #] totaling [Amount], due [Due date], now 90 days overdue.

Unless payment in full (or a signed payment plan) is received by [Cut-off date], we will refer this account for collection.

Payment: [Payment link or bank details]
Invoice attached for your records.

Regards,
[Your name]
[Your company]`,
  },
  {
    slug: "thank-you-for-payment-email",
    name: "Thank you for payment",
    seoTitle: "Free Thank You for Payment Email Template",
    description:
      "Free short thank-you email after a client pays an invoice. Reinforces goodwill and closes the loop professionally.",
    stage: "After payment",
    tone: "Warm",
    category: "Payments received",
    subject: "Thanks — invoice [Invoice #] received",
    body: `Hi [Client name],

Payment for invoice [Invoice #] ([Amount]) landed — thank you.

Looking forward to the next project together.

Best,
[Your name]`,
  },
  {
    slug: "partial-payment-acknowledgment",
    name: "Partial payment acknowledgment",
    seoTitle: "Free Partial Payment Acknowledgment Email Template",
    description:
      "Free email template to acknowledge a partial payment, clearly restate the remaining balance, and confirm the next due date without sounding ungrateful.",
    stage: "Partial payment",
    tone: "Clear",
    category: "Payments received",
    subject: "Partial payment received — [Amount remaining] still due on [Invoice #]",
    body: `Hi [Client name],

Thanks — I received [Amount paid] toward invoice [Invoice #].

Remaining balance: [Amount remaining], due by [Next due date].
Pay the rest here: [Payment link].

Appreciate it,
[Your name]`,
  },
  {
    slug: "disputed-invoice-response",
    name: "Disputed invoice — calm reply",
    seoTitle: "Free Disputed Invoice Response Email Template",
    description:
      "Free professional email template when a client disputes an invoice. Acknowledges the issue and proposes a clear next step.",
    stage: "Dispute",
    tone: "Calm",
    category: "Disputes",
    subject: "Re: invoice [Invoice #] — let's resolve this",
    body: `Hi [Client name],

Thanks for flagging the concern on invoice [Invoice #] ([Amount]).

I've reviewed [brief note: line item / scope / hours]. Here's what I propose: [proposed fix — credit, revised invoice, or call].

If that works, I'll send an updated invoice today. If not, let's hop on a 15-minute call this week.

Best,
[Your name]`,
  },
  {
    slug: "broken-payment-promise-follow-up",
    name: "Broken payment promise follow-up",
    seoTitle: "Free Follow-Up Email for a Missed Payment Promise",
    description:
      "Free follow-up email template for when a client promised a payment date and missed it — firm, factual, and short, without sounding accusatory.",
    stage: "Missed promise",
    tone: "Direct",
    category: "Overdue follow-ups",
    subject: "Following up — payment promised for [Promised date]",
    body: `Hi [Client name],

On [Promise date conversation], you said invoice [Invoice #] ([Amount]) would be paid by [Promised date]. That date has passed and payment hasn't arrived.

Please send payment today or reply with a revised date I can rely on: [Payment link].

Thanks,
[Your name]`,
  },
  {
    slug: "first-invoice-new-client-reminder",
    name: "First invoice — new client reminder",
    seoTitle: "Free First Invoice Reminder Email Template",
    description:
      "Free gentle reminder template for a new client's first invoice. Helpful tone that protects a new relationship.",
    stage: "New client",
    tone: "Helpful",
    category: "Due & early overdue",
    subject: "Checking in on your first invoice ([Invoice #])",
    body: `Hi [Client name],

Hope the kickoff has been smooth. Just checking that invoice [Invoice #] for [Amount] (due [Due date]) arrived okay — first invoices sometimes land in the wrong inbox.

Happy to resend or adjust billing details. Pay here whenever ready: [Payment link].

Excited to keep going,
[Your name]`,
  },
  {
    slug: "multiple-overdue-invoices-summary",
    name: "Multiple overdue invoices — summary",
    seoTitle: "Free Email Template for Multiple Overdue Invoices",
    description:
      "Free summary email when several invoices are overdue. Lists each balance so the client can clear everything in one go.",
    stage: "Multiple invoices",
    tone: "Organized",
    category: "Overdue follow-ups",
    subject: "Outstanding invoices totaling [Total amount]",
    body: `Hi [Client name],

Quick summary of open invoices:

• [Invoice #1] — [Amount 1] — due [Date 1] — [X] days overdue
• [Invoice #2] — [Amount 2] — due [Date 2] — [Y] days overdue

Total outstanding: [Total amount]

You can pay the full balance here: [Payment link]. If a payment plan would help, reply and we'll set one up.

Thanks,
[Your name]`,
  },
  {
    slug: "invoice-sent-please-process",
    name: "Invoice sent — please process",
    seoTitle: "Free Invoice Delivery Email Template",
    description:
      "Free email to send with a new invoice: clear due date, how to pay, and what to do if something looks wrong — sets expectations before any chase.",
    stage: "On send",
    tone: "Clear",
    category: "Before due",
    subject: "Invoice [Invoice #] for [Amount] — due [Due date]",
    body: `Hi [Client name],

Please find invoice [Invoice #] for [Amount], due [Due date].

Pay here when ready: [Payment link or bank details]
If PO numbers, billing contacts, or line items need adjusting, reply and I'll update the invoice before the due date.

Thanks for the work — looking forward to the next one,
[Your name]`,
  },
  {
    slug: "confirm-invoice-received-email",
    name: "Confirm invoice received",
    seoTitle: "Free Confirm Invoice Received Email Template",
    description:
      "Free short email asking the client to confirm they received an invoice — a low-pressure check-in before you escalate to a real payment chase.",
    stage: "Delivery check",
    tone: "Neutral",
    category: "Before due",
    subject: "Did invoice [Invoice #] reach you?",
    body: `Hi [Client name],

Could you confirm you received invoice [Invoice #] for [Amount] (due [Due date])?

If it didn't arrive, reply and I'll resend immediately (and update your billing contact if needed). Copy attached.

Thanks,
[Your name]`,
  },
  {
    slug: "multiple-invoices-coming-due",
    name: "Multiple invoices coming due",
    seoTitle: "Free Template for Multiple Invoices Coming Due",
    description:
      "Free pre-due summary when several invoices share the same client. Helps AP schedule one payment run before anything is late.",
    stage: "Multiple · before due",
    tone: "Helpful",
    category: "Before due",
    subject: "Upcoming invoices totaling [Total amount]",
    body: `Hi [Client name],

A heads-up on invoices coming due so nothing slips your payment run:

• [Invoice #1] — [Amount 1] — due [Date 1]
• [Invoice #2] — [Amount 2] — due [Date 2]

Combined total: [Total amount]

If everything looks right, you can settle here when ready: [Payment link]. Happy to combine into one remittance or adjust timing if needed.

Thanks,
[Your name]`,
  },
  {
    slug: "thank-you-multiple-invoices-paid",
    name: "Thanks — multiple invoices paid",
    seoTitle: "Free Thank You Email for Multiple Invoice Payments",
    description:
      "Free thank-you email after a client clears several invoices at once. Short, warm, and good for repeat payment habits.",
    stage: "Multiple · paid",
    tone: "Grateful",
    category: "Payments received",
    subject: "Thanks — payments received ([Total amount])",
    body: `Hi [Client name],

Confirming we've received your payment covering:

• [Invoice #1] — [Amount 1]
• [Invoice #2] — [Amount 2]

Total applied: [Total amount]. Thank you — that clears the open balance on our side.

If you need remittance details or receipts for your records, just say the word.

Appreciate you,
[Your name]`,
  },
  {
    slug: "freelancer-polite-payment-reminder",
    name: "Freelancer polite reminder",
    seoTitle: "Free Freelancer Polite Payment Reminder Email Template",
    description:
      "Free polite payment reminder template written for freelancers and solo consultants — casual enough for a direct client relationship, clear enough to get a real answer.",
    stage: "Early overdue",
    tone: "Polite",
    category: "Freelancer",
    subject: "Quick one — invoice [Invoice #]",
    body: `Hi [Client name],

Hope things are good on your end! Just a quick nudge that invoice [Invoice #] for [Amount] (sent [Send date]) hasn't come through yet.

No rush if it's just sitting in a queue — could you let me know when it's likely to clear? Invoice attached again in case it got buried.

Thanks so much,
[Your name]`,
  },
  {
    slug: "freelancer-firm-payment-reminder",
    name: "Freelancer firm reminder",
    seoTitle: "Free Freelancer Firm Payment Reminder Email Template",
    description:
      "Free firmer follow-up template for freelancers after a first reminder went unanswered — direct about the impact on your business without burning the relationship.",
    stage: "After first reminder",
    tone: "Firm",
    category: "Freelancer",
    subject: "Following up again — invoice [Invoice #] still open",
    body: `Hi [Client name],

I reached out last week about invoice [Invoice #] for [Amount] and haven't heard back yet. As a freelancer, unpaid invoices like this one directly affect my ability to take on new work, so I wanted to follow up directly.

Could you confirm a payment date this week? Happy to jump on a quick call if something's holding it up.

Pay here: [Payment link]

Thanks,
[Your name]`,
  },
  {
    slug: "freelancer-30-days-overdue-reminder",
    name: "Freelancer overdue — 30 days",
    seoTitle: "Free Freelancer 30-Day Overdue Invoice Email Template",
    description:
      "Free template for freelancers when an invoice hits 30 days overdue — states the facts plainly and asks for a concrete plan, one professional to another.",
    stage: "30 days overdue",
    tone: "Direct",
    category: "Freelancer",
    subject: "Invoice [Invoice #] — 30 days overdue, need a plan",
    body: `Hi [Client name],

Invoice [Invoice #] for [Amount], sent [Send date], is now a full month overdue with no response to my last two follow-ups.

I get that things get busy, but I need a concrete payment date to keep this from becoming a bigger issue for either of us. Can you confirm by [date] when this will be settled — in full or as a plan?

[Payment link or bank details]

[Your name]`,
  },
  {
    slug: "agency-retainer-invoice-follow-up",
    name: "Agency follow-up — retainer invoice",
    seoTitle: "Free Agency Retainer Invoice Follow-Up Email Template",
    description:
      "Free follow-up template for agencies chasing an overdue monthly retainer invoice — flags the ongoing-work angle without sounding like a threat.",
    stage: "Overdue",
    tone: "Professional",
    category: "Agency",
    subject: "[Month] retainer invoice [Invoice #] — following up",
    body: `Hi [Client name],

Following up on invoice [Invoice #] for your [Month] retainer ([Amount]), due [Due date].

Since this covers work we're actively delivering this month, I wanted to flag it before it affects the schedule on our end. Could you confirm when it'll be paid?

Invoice attached — pay here: [Payment link].

Best,
[Your name]
[Agency name]`,
  },
  {
    slug: "agency-milestone-invoice-follow-up",
    name: "Agency follow-up — project milestone",
    seoTitle: "Free Agency Milestone Invoice Follow-Up Email Template",
    description:
      "Free follow-up template for agencies chasing payment on a completed project milestone — ties the ask directly to delivered, approved work.",
    stage: "Overdue",
    tone: "Professional",
    category: "Agency",
    subject: "Milestone invoice [Invoice #] — [Milestone name]",
    body: `Hi [Client name],

Invoice [Invoice #] for [Amount] was issued on completion and sign-off of [Milestone name], due [Due date]. It's still showing as unpaid on our side.

Since the next milestone is scheduled to kick off [Next milestone date], could you confirm payment status so we can plan accordingly?

Pay here: [Payment link]. Invoice attached.

Best,
[Your name]
[Agency name]`,
  },
  {
    slug: "agency-final-invoice-follow-up",
    name: "Agency follow-up — unpaid final invoice",
    seoTitle: "Free Agency Final Invoice Follow-Up Email Template",
    description:
      "Free template for agencies chasing the last invoice on a wrapped-up project — useful when there's no more upcoming work to tie the reminder to.",
    stage: "Overdue",
    tone: "Firm",
    category: "Agency",
    subject: "Final invoice [Invoice #] — project closeout",
    body: `Hi [Client name],

With [Project name] wrapped, invoice [Invoice #] for [Amount] (final invoice, due [Due date]) is still outstanding.

Since there's no further work scheduled to flag this against, I'd appreciate a specific payment date so we can close this out cleanly on both sides.

[Payment link or bank details]. Invoice attached for reference.

Regards,
[Your name]
[Agency name]`,
  },
  {
    slug: "corporate-overdue-invoice-escalation",
    name: "Corporate overdue invoice escalation",
    seoTitle: "Free Corporate Overdue Invoice Escalation Email Template",
    description:
      "Free escalation template for vendors chasing a corporate client whose standard reminders haven't landed — addressed for routing into a larger organization's process.",
    stage: "Overdue, escalating",
    tone: "Formal",
    category: "Corporate",
    subject: "Escalation: invoice [Invoice #] — [Amount], PO [PO #]",
    body: `Dear [Contact name],

We're escalating invoice [Invoice #] ([Amount], PO reference [PO #]), due [Due date], as it remains unpaid despite two prior reminders sent to [Original contact].

If this needs to be routed to a different contact or approval step on your side, please point us to the right person — otherwise, please confirm an expected payment date by [Deadline date].

Invoice and PO reference attached.

Regards,
[Your name]
[Your company]`,
  },
  {
    slug: "corporate-finance-department-reminder",
    name: "Corporate finance department reminder",
    seoTitle: "Free Corporate Finance Department Payment Reminder Template",
    description:
      "Free reminder template addressed directly to a client's accounts payable / finance team, with the reference numbers AP departments typically need to process payment.",
    stage: "Overdue",
    tone: "Formal",
    category: "Corporate",
    subject: "AP follow-up: invoice [Invoice #] — vendor [Your company]",
    body: `Dear Accounts Payable Team,

We're following up on invoice [Invoice #] for [Amount], due [Due date], issued to [Client company] under PO [PO #] / vendor ID [Vendor ID].

Please let us know if any documentation is missing on your end that's holding up processing, or confirm the expected payment date.

Invoice attached, along with the original PO for reference.

Best regards,
[Your name]
[Your company]`,
  },
  {
    slug: "final-notice-before-legal-action",
    name: "Final notice before legal action",
    seoTitle: "Free Final Notice Before Legal Action Email Template",
    description:
      "Free, seriously-worded final notice template for use before considering legal or collections action on a long-overdue invoice. Not legal advice — check local requirements before sending a real pre-action letter.",
    stage: "Severely overdue",
    tone: "Legal",
    category: "Legal",
    subject: "Final notice before legal action: invoice [Invoice #]",
    body: `Dear [Client name],

This is a final notice regarding invoice [Invoice #] for [Amount], originally due [Due date] and now [Days overdue] days overdue, despite prior reminders sent on [Prior reminder dates].

If payment in full is not received by [Final deadline date], we will have no choice but to consider further collection action, which may include referring this matter to a collections agency or pursuing legal remedies available to us, without further notice.

We would prefer to resolve this directly — please contact us immediately if you dispute this invoice or wish to arrange payment.

[Payment link or bank details]

Regards,
[Your name]
[Your company]`,
  },
  {
    slug: "client-ghosted-me-template",
    name: "Client ghosted me",
    seoTitle: "Free Email Template for When a Client Goes Silent (Ghosted)",
    description:
      "Free template for the specific, common freelance nightmare: a client who was responsive, went quiet, and now isn't replying to anything — invoices or messages.",
    stage: "No response at all",
    tone: "Direct, low-drama",
    category: "Ghosted client",
    subject: "Still there? Invoice [Invoice #] + a few messages unanswered",
    body: `Hi [Client name],

I haven't heard back on invoice [Invoice #] for [Amount] or my last couple of messages, which isn't like you — so first, I hope everything's okay.

If something's changed on your end, just let me know, even briefly. Otherwise, I need to treat this as unresponsive and will follow up once more before [next step, e.g. "pausing further work" or "escalating to a formal notice"] on [date].

[Payment link or bank details]

[Your name]`,
  },
];

mkdirSync(outDir, { recursive: true });

// Docstoc-style business/legal document templates — a distinct content type from the chase-email
// TEMPLATES above (Markdown body, no subject line, no compose flow). Own output directory so the
// existing /free-templates/ URL and "chase email" branding stay untouched.
const docOutDir = join(__dirname, "../public/document-templates");
mkdirSync(docOutDir, { recursive: true });

/** Docstoc-style category taxonomy — order controls the jump menu and section order. */
const DOCUMENT_CATEGORIES = ["Business", "Legal", "Real Estate", "Finance", "HR"];

/** @type {Array<{
 *  slug: string;
 *  name: string;
 *  seoTitle: string;
 *  description: string;
 *  category: string;
 *  bodyMarkdown: string;
 * }>} */
const DOCUMENT_TEMPLATES = [
  {
    slug: "llc-operating-agreement-single-member-template",
    name: "Single-Member LLC Operating Agreement",
    seoTitle: "Free Single-Member LLC Operating Agreement Template",
    description:
      "Free single-member LLC operating agreement template — defines ownership, management, and finances for a solo-owned LLC.",
    category: "Business",
    bodyMarkdown: `# Single-Member LLC Operating Agreement

**Company:** [Company Name], a [State] limited liability company (the "Company")
**Sole Member:** [Member Name] (the "Member")
**Effective Date:** [Date]

## 1. Formation
The Company was formed under the laws of the State of [State] by filing Articles of Organization with the Secretary of State on [Formation Date]. This Agreement governs the Company's internal affairs.

## 2. Purpose
The Company may engage in any lawful business activity permitted under [State] law.

## 3. Ownership
The Member owns 100% of the membership interests in the Company.

## 4. Capital Contributions
The Member has contributed [Contribution Amount / Description] as initial capital.

## 5. Management
The Company is managed by its sole Member, who has full authority to bind the Company and make all decisions on its behalf.

## 6. Distributions
Distributions of available cash are made to the Member at such times and in such amounts as the Member determines.

## 7. Liability
The Member's liability is limited to the extent provided under [State] LLC law. The Member and Company agree to maintain separate finances (separate bank accounts, no commingling of funds) to preserve this liability protection.

## 8. Dissolution
The Company may be dissolved upon the Member's written decision, or as otherwise required by law.

## 9. Amendments
This Agreement may be amended only by a signed written instrument executed by the Member.

---
Signed: ______________________  Date: ____________
[Member Name], Sole Member

*This document is provided for informational and educational purposes only and does not constitute legal or tax advice. Consult a licensed attorney in your state before relying on it.*`,
  },
  {
    slug: "one-page-business-plan-template",
    name: "One-Page Business Plan",
    seoTitle: "Free One-Page Business Plan Template",
    description:
      "Free one-page business plan template — a compact framework for pitching a new business or organizing your own thinking.",
    category: "Business",
    bodyMarkdown: `# One-Page Business Plan: [Business Name]

## Problem
[What problem does this business solve, and for whom?]

## Solution
[What is the product or service? How does it solve the problem?]

## Target Customer
[Who buys this? Be specific — demographics, industry, size, behavior.]

## Revenue Model
[How does the business make money — subscriptions, one-time sales, commission, other?]

## Key Costs
[What are the main costs to deliver the product/service and run the business?]

## Competitive Advantage
[Why you, and why now? What's hard to copy?]

## Go-to-Market
[How will the first 10, 100, and 1,000 customers be reached?]

## Milestones (Next 12 Months)
- [Milestone 1 — target date]
- [Milestone 2 — target date]
- [Milestone 3 — target date]

## Funding Needs (if applicable)
[Amount needed, and what it will be used for.]

*This document is provided for informational and educational purposes only and does not constitute legal, tax, or investment advice.*`,
  },
  {
    slug: "mutual-nda-template",
    name: "Mutual Non-Disclosure Agreement (NDA)",
    seoTitle: "Free Mutual Non-Disclosure Agreement (NDA) Template",
    description:
      "Free mutual NDA template for two parties sharing confidential information — covers what counts as confidential, permitted use, and term.",
    category: "Legal",
    bodyMarkdown: `# Mutual Non-Disclosure Agreement

This Agreement is made on [Date] between [Party A Name] ("Party A") and [Party B Name] ("Party B"), together the "Parties."

## 1. Purpose
The Parties wish to discuss [Purpose of Discussion, e.g. a potential business relationship] (the "Purpose") and may disclose confidential information to each other in connection with it.

## 2. Confidential Information
"Confidential Information" means any non-public business, technical, or financial information disclosed by one Party (the "Disclosing Party") to the other (the "Receiving Party"), whether oral, written, or in any other form, that is designated confidential or that a reasonable person would understand to be confidential given its nature.

## 3. Obligations
The Receiving Party agrees to:
- Use the Confidential Information only for the Purpose;
- Protect it with at least the same care used for its own confidential information, and no less than reasonable care;
- Not disclose it to any third party without the Disclosing Party's prior written consent, except to employees or advisors who need to know it for the Purpose and are bound by similar confidentiality obligations.

## 4. Exclusions
Confidential Information does not include information that: (a) is or becomes public through no fault of the Receiving Party; (b) was already known to the Receiving Party before disclosure; (c) is independently developed without use of the Confidential Information; or (d) is required to be disclosed by law or court order (with prompt notice to the Disclosing Party where legally permitted).

## 5. Term
This Agreement's confidentiality obligations remain in effect for [Term, e.g. 2 years] from the date of disclosure, or until the information no longer qualifies as confidential under Section 4.

## 6. No License
Nothing in this Agreement grants either Party any rights to the other's intellectual property beyond what's needed for the Purpose.

## 7. Governing Law
This Agreement is governed by the laws of [State/Country], without regard to conflict-of-laws principles.

---
Party A: ______________________  Date: ____________
Party B: ______________________  Date: ____________

*This document is provided for informational and educational purposes only and does not constitute legal advice. Consult a licensed attorney before relying on it.*`,
  },
  {
    slug: "demand-letter-unpaid-invoice-template",
    name: "Demand Letter for Unpaid Invoice",
    seoTitle: "Free Demand Letter for Unpaid Invoice Template",
    description:
      "Free formal demand letter template for a seriously overdue invoice — a firm final notice before considering collections or legal action.",
    category: "Legal",
    bodyMarkdown: `# Demand Letter for Unpaid Invoice

[Your Name / Business Name]
[Your Address]
[Date]

[Client Name]
[Client Address]

**RE: Formal Demand for Payment — Invoice [Invoice #]**

Dear [Client Name],

This letter is a formal demand for payment of invoice [Invoice #], issued on [Invoice Date] in the amount of [Amount], which was due on [Due Date] and remains unpaid as of the date of this letter — now [Days Overdue] days overdue.

Despite [previous reminders sent on Date(s), if any], no payment or response has been received.

**Please remit full payment of [Amount] within [Deadline, e.g. 10 days] of the date of this letter.** Payment can be made via [Payment Method / Link].

If payment is not received by [Deadline Date], I may pursue further action, which could include referring this matter to a collections agency or pursuing a claim in small claims court, and may seek recovery of associated costs where permitted by law.

I would prefer to resolve this directly and promptly. If there is a dispute about this invoice or a payment plan you'd like to propose, please contact me at [Phone/Email] before the deadline above.

Sincerely,
[Your Name]

---
*This document is provided for informational and educational purposes only and does not constitute legal advice. Requirements for demand letters and collections vary by state/country — consult a licensed attorney for your specific situation.*`,
  },
  {
    slug: "residential-lease-agreement-template",
    name: "Residential Lease Agreement",
    seoTitle: "Free Residential Lease Agreement Template",
    description:
      "Free residential lease agreement template covering rent, deposit, term, and basic landlord/tenant obligations.",
    category: "Real Estate",
    bodyMarkdown: `# Residential Lease Agreement

This Lease is made on [Date] between [Landlord Name] ("Landlord") and [Tenant Name] ("Tenant") for the property at [Property Address] (the "Premises").

## 1. Term
This lease begins on [Start Date] and ends on [End Date] (the "Term"), unless renewed or terminated earlier as provided herein.

## 2. Rent
Tenant agrees to pay rent of [Rent Amount] per month, due on the [Day, e.g. 1st] of each month, payable via [Payment Method].

## 3. Security Deposit
Tenant will pay a security deposit of [Deposit Amount] before move-in, refundable within [Number] days after the lease ends, less any deductions for damage beyond normal wear and tear, as permitted under [State] law.

## 4. Use of Premises
The Premises will be used solely as a residence for [Number] occupant(s): [Occupant Names]. No subletting without Landlord's prior written consent.

## 5. Utilities
[Landlord/Tenant] is responsible for: [List utilities and who pays for each].

## 6. Maintenance
Tenant will keep the Premises clean and promptly notify Landlord of needed repairs. Landlord is responsible for maintaining the Premises in habitable condition per applicable law.

## 7. Termination
Either party may terminate this lease at the end of the Term with [Notice Period] written notice. Early termination terms: [Describe, if any].

## 8. Governing Law
This lease is governed by the laws of the State of [State].

---
Landlord: ______________________  Date: ____________
Tenant: ______________________  Date: ____________

*This document is provided for informational and educational purposes only and does not constitute legal advice. Landlord-tenant law varies significantly by state/locality — consult a licensed attorney or your local housing authority before using this template.*`,
  },
  {
    slug: "lease-termination-notice-template",
    name: "Notice to Vacate / Lease Termination Letter",
    seoTitle: "Free Notice to Vacate / Lease Termination Letter Template",
    description:
      "Free lease termination notice template for landlords or tenants ending a residential lease at the end of its term.",
    category: "Real Estate",
    bodyMarkdown: `# Notice to Vacate / Lease Termination Letter

[Your Name]
[Your Address]
[Date]

[Recipient Name]
[Recipient Address]

**RE: Notice of Lease Termination — [Property Address]**

Dear [Recipient Name],

This letter serves as formal notice that the lease for the property at [Property Address], dated [Original Lease Date], will terminate on [Termination Date].

[If tenant-initiated: I do not intend to renew this lease and will vacate the Premises on or before the termination date above.]
[If landlord-initiated: The Landlord does not intend to renew this lease. Please vacate the Premises and return all keys by the termination date above.]

Per the terms of the lease, this notice is being provided at least [Notice Period] before the termination date, as required.

[Optional: Please advise on move-out inspection scheduling, and confirm the address for return of the security deposit.]

Sincerely,
[Your Name]

---
*This document is provided for informational and educational purposes only and does not constitute legal advice. Required notice periods vary by state/locality — confirm your jurisdiction's requirements before sending.*`,
  },
  {
    slug: "simple-promissory-note-template",
    name: "Simple Promissory Note",
    seoTitle: "Free Simple Promissory Note Template",
    description:
      "Free promissory note template for a personal or business loan — documents the amount, repayment terms, and interest (if any).",
    category: "Finance",
    bodyMarkdown: `# Promissory Note

**Principal Amount:** [Amount]
**Date:** [Date]

For value received, [Borrower Name] ("Borrower") promises to pay [Lender Name] ("Lender") the principal sum of [Amount], together with interest as set out below.

## 1. Interest
[Interest Rate]% per year, simple interest, calculated on the outstanding balance. [Or: "This note is interest-free," if applicable.]

## 2. Repayment
Borrower will repay the full amount according to the following schedule: [Describe — e.g. a single lump sum by a fixed date, or monthly installments of [Amount] starting [Date]].

## 3. Prepayment
Borrower may repay all or part of the outstanding balance at any time without penalty.

## 4. Default
If any payment is more than [Number] days late, the full remaining balance becomes due immediately at Lender's option, and may accrue interest at [Default Rate]% per year until paid.

## 5. Governing Law
This note is governed by the laws of [State/Country].

---
Borrower: ______________________  Date: ____________
Lender: ______________________  Date: ____________

*This document is provided for informational and educational purposes only and does not constitute legal or tax advice. Lending laws (including usury limits) vary by state/country — consult a licensed attorney for larger or commercial loans.*`,
  },
  {
    slug: "expense-reimbursement-request-template",
    name: "Expense Reimbursement Request",
    seoTitle: "Free Expense Reimbursement Request Template",
    description:
      "Free expense reimbursement request template for employees or contractors submitting business expenses for repayment.",
    category: "Finance",
    bodyMarkdown: `# Expense Reimbursement Request

**Submitted by:** [Name]
**Department / Role:** [Department or Role]
**Date submitted:** [Date]
**Reimbursement period:** [Start Date] – [End Date]

## Expense Summary

| Date | Description | Category | Amount | Receipt attached? |
|------|-------------|----------|--------|--------------------|
| [Date] | [Description] | [Category, e.g. Travel] | [Amount] | [Yes/No] |
| [Date] | [Description] | [Category] | [Amount] | [Yes/No] |
| [Date] | [Description] | [Category] | [Amount] | [Yes/No] |

**Total requested: [Total Amount]**

## Notes
[Business justification, project/client code, or any context the approver needs.]

## Approval
Approved by: ______________________  Date: ____________
Payment method: [Direct deposit / Check / Other]

*This document is provided for informational and educational purposes only. Confirm your organization's own expense policy for receipt requirements and reimbursable categories.*`,
  },
  {
    slug: "employee-offer-letter-template",
    name: "Employee Offer Letter",
    seoTitle: "Free Employee Offer Letter Template",
    description:
      "Free job offer letter template covering role, compensation, start date, and standard at-will/contingency language.",
    category: "HR",
    bodyMarkdown: `# Offer of Employment

[Date]

Dear [Candidate Name],

We are pleased to offer you the position of **[Job Title]** at [Company Name] ("Company"), reporting to [Manager Name].

## Key Terms
- **Start date:** [Start Date]
- **Compensation:** [Salary/Hourly Rate], paid [Frequency, e.g. bi-weekly]
- **Employment type:** [Full-time / Part-time], [Exempt / Non-exempt] (if applicable)
- **Location:** [Office location / Remote]
- **Benefits:** [Summary — health insurance, PTO, retirement plan, etc., or reference to a benefits summary document]
- **Reporting manager:** [Manager Name]

## At-Will Employment
[If applicable to your jurisdiction:] Employment with the Company is at-will, meaning either you or the Company may end the employment relationship at any time, with or without cause or notice.

## Contingencies
This offer is contingent upon [background check / reference check / proof of eligibility to work, as applicable].

Please confirm your acceptance by signing below and returning this letter by [Response Deadline].

We're excited about the possibility of you joining the team.

Sincerely,
[Sender Name]
[Sender Title]

---
Accepted: ______________________  Date: ____________
[Candidate Name]

*This document is provided for informational and educational purposes only and does not constitute legal advice. Employment law varies by jurisdiction — consult a licensed attorney or HR professional before using this template.*`,
  },
  {
    slug: "employee-written-warning-template",
    name: "Employee Written Warning / Disciplinary Notice",
    seoTitle: "Free Employee Written Warning Template",
    description:
      "Free written warning template for documenting a performance or conduct issue as part of a formal disciplinary process.",
    category: "HR",
    bodyMarkdown: `# Written Warning

**Employee:** [Employee Name]
**Position:** [Job Title]
**Date:** [Date]
**Issued by:** [Manager Name]

## Nature of the Issue
[Describe the specific performance or conduct issue, with dates and factual details — avoid generalizations.]

## Prior Discussion
[Reference any prior verbal warning or coaching conversation, with date(s).]

## Expectation Going Forward
[Describe clearly what needs to change and by when.]

## Consequences of Continued Issues
Failure to improve within [Timeframe] may result in further disciplinary action, up to and including termination of employment.

## Employee Comments
[Space for the employee to add their own comments, if your process allows it.]

---
Manager signature: ______________________  Date: ____________
Employee signature: ______________________  Date: ____________
*(Employee signature acknowledges receipt, not necessarily agreement.)*

*This document is provided for informational and educational purposes only and does not constitute legal advice. Disciplinary processes and documentation requirements vary by jurisdiction and company policy — consult HR or legal counsel before using this template.*`,
  },
  {
    slug: "employment-agreement-template",
    name: "Employment Agreement",
    seoTitle: "Free Employment Agreement Template",
    description:
      "Free employment agreement template covering role, pay, benefits, and termination terms for a new hire.",
    category: "HR",
    bodyMarkdown: `# Employment Agreement

**Employer:** [Company Name] (the "Company")
**Employee:** [Employee Name] (the "Employee")
**Start Date:** [Date]

## 1. Position and Duties
The Company employs the Employee as [Job Title], reporting to [Manager/Title]. The Employee will perform the duties customarily associated with this role and any other duties reasonably assigned.

## 2. Compensation
The Employee will be paid [Salary/Hourly Rate], paid [Pay Frequency, e.g. bi-weekly], subject to standard payroll deductions.

## 3. Benefits
The Employee is eligible for [Benefits — e.g. health insurance, paid time off, retirement plan] per the Company's policies, as they may change from time to time.

## 4. Employment Type
This is an [At-will / Fixed-term] employment relationship. [If at-will: Either party may end it at any time, with or without cause or notice, subject to applicable law.]

## 5. Confidentiality
The Employee agrees not to disclose the Company's confidential or proprietary information, during employment or after it ends.

## 6. Termination
Employment may be terminated by either party with [Notice Period] written notice, or immediately by the Company for cause.

## 7. Governing Law
This Agreement is governed by the laws of [State/Country].

---
Employer: ______________________  Date: ____________
Employee: ______________________  Date: ____________

*This document is provided for informational and educational purposes only and does not constitute legal advice. Employment law varies significantly by state/country — consult a licensed attorney before using this template.*`,
  },
  {
    slug: "general-power-of-attorney-template",
    name: "General Power of Attorney",
    seoTitle: "Free General Power of Attorney Template",
    description:
      "Free general power of attorney template — authorizes someone to act on your behalf for financial and legal matters.",
    category: "Legal",
    bodyMarkdown: `# General Power of Attorney

I, [Principal Name], of [Address] (the "Principal"), appoint [Agent Name], of [Address] (the "Agent"), as my attorney-in-fact.

## 1. Grant of Authority
The Agent is authorized to act on my behalf in the following matters: [List — e.g. banking, real estate transactions, tax filings, business operations].

## 2. Effective Date
This Power of Attorney takes effect on [Date] and [is effective immediately / becomes effective only upon my incapacity, as certified by a physician].

## 3. Duration
This Power of Attorney remains in effect until [Date, or "revoked in writing," or "my death"], unless earlier revoked by me in writing.

## 4. Revocation
I may revoke this Power of Attorney at any time by providing written notice to the Agent and any third parties relying on it.

## 5. Third-Party Reliance
Any third party may rely on this document as evidence of the Agent's authority until they receive actual notice of its revocation.

---
Principal: ______________________  Date: ____________
[Notarization block, if required in your state]

*This document is provided for informational and educational purposes only and does not constitute legal advice. Power of attorney requirements (including notarization and witnessing) vary significantly by state — consult a licensed attorney before using this template.*`,
  },
  {
    slug: "press-release-template",
    name: "Press Release",
    seoTitle: "Free Press Release Template",
    description:
      "Free press release template for announcing product launches, funding, partnerships, or other company news.",
    category: "Business",
    bodyMarkdown: `# Press Release Template

**FOR IMMEDIATE RELEASE**

## [Headline — clear, specific, under 15 words]

**[City, State] — [Date]** — [Opening paragraph: the single most important fact of the announcement, in one or two sentences. Who, what, when, where, why it matters.]

[Second paragraph: supporting details — background, context, or the problem this news addresses.]

"[A quote from a founder, executive, or spokesperson, in their own voice — not a generic statement]," said [Name, Title].

[Third paragraph: any additional detail — numbers, availability, pricing, or next steps.]

## About [Company Name]
[2-3 sentence company boilerplate — what you do, for whom, and any notable traction.]

## Media Contact
[Name]
[Email]
[Phone, if applicable]

###`,
  },
  {
    slug: "cover-letter-template",
    name: "Cover Letter",
    seoTitle: "Free Cover Letter Template",
    description:
      "Free cover letter template for a job application — structured to highlight fit without repeating your resume.",
    category: "HR",
    bodyMarkdown: `# Cover Letter

[Your Name]
[Your Email] · [Your Phone]
[Date]

[Hiring Manager Name]
[Company Name]

Dear [Hiring Manager Name / "Hiring Team"],

## Opening
[One or two sentences: the role you're applying for and a specific reason you're interested in this company — not a generic opener.]

## Why you're a fit
[One or two sentences on the most relevant experience or achievement for this specific role — a number or concrete result if you have one.]

## Why this company
[One sentence connecting something specific about the company/role to your own goals — shows you didn't send a form letter.]

## Close
I'd welcome the chance to talk about how I can contribute to [Team/Company Name]. Thank you for your time and consideration.

Sincerely,
[Your Name]

*This document is a structural template only — the content in each section should be written specifically for the role and company, not copied verbatim.*`,
  },
  {
    slug: "letter-of-intent-template",
    name: "Letter of Intent",
    seoTitle: "Free Letter of Intent (LOI) Template",
    description:
      "Free letter of intent template outlining preliminary terms before a formal contract — for a deal, purchase, or partnership.",
    category: "Business",
    bodyMarkdown: `# Letter of Intent

**From:** [Party A Name]
**To:** [Party B Name]
**Date:** [Date]
**Re: Letter of Intent — [Subject, e.g. "Proposed Acquisition of ___"]**

This Letter of Intent ("LOI") outlines the preliminary understanding between [Party A] and [Party B] regarding [Transaction Description]. Except as noted in Section 5, this LOI is non-binding and intended only to guide negotiation of a definitive agreement.

## 1. Proposed Transaction
[Describe the deal — e.g. purchase price, assets/services involved, key terms.]

## 2. Key Terms
- [Term 1 — e.g. price/valuation]
- [Term 2 — e.g. timeline]
- [Term 3 — e.g. conditions to close]

## 3. Due Diligence
Each party will have [Number] days to complete due diligence before finalizing a definitive agreement.

## 4. Exclusivity
[Optional: For [Number] days from the date of this LOI, [Party] will not negotiate a similar transaction with any other party.]

## 5. Binding Provisions
Sections 4 (Exclusivity) and 6 (Confidentiality) are binding upon signature; all other provisions are non-binding statements of intent only.

## 6. Confidentiality
Both parties agree to keep the terms of this LOI and any information exchanged during negotiations confidential.

---
[Party A]: ______________________  Date: ____________
[Party B]: ______________________  Date: ____________

*This document is provided for informational and educational purposes only and does not constitute legal advice. Consult a licensed attorney before relying on any binding provisions.*`,
  },
  {
    slug: "executive-summary-template",
    name: "Executive Summary",
    seoTitle: "Free Executive Summary Template",
    description:
      "Free executive summary template for a business plan, pitch deck, or investor update — the one-page version of your plan.",
    category: "Business",
    bodyMarkdown: `# Executive Summary: [Company Name]

## The Problem
[What problem exists, for whom, and how big is it?]

## The Solution
[What you've built and why it solves the problem better than alternatives.]

## Traction
[Real numbers only — revenue, users, growth rate, notable customers. If pre-launch, say so rather than inventing numbers.]

## Market
[Size of the addressable market and why now is the right time.]

## Business Model
[How the company makes money.]

## Team
[Founders/key team members and the relevant experience that makes this team credible for this problem.]

## The Ask
[What you're raising, or what you're asking the reader to do — funding amount, partnership, introduction, etc.]

*Keep this to one page. Every claim here should be something you can back up if asked — an executive summary that oversells traction or team credentials tends to cost more credibility than it buys.*`,
  },
  {
    slug: "project-proposal-template",
    name: "Project Proposal",
    seoTitle: "Free Project Proposal Template",
    description:
      "Free project proposal template for pitching a new project to a client, manager, or stakeholder.",
    category: "Business",
    bodyMarkdown: `# Project Proposal: [Project Name]

**Prepared for:** [Client/Stakeholder Name]
**Prepared by:** [Your Name/Company]
**Date:** [Date]

## Background
[Why this project — what problem or opportunity prompted it.]

## Objectives
[What success looks like — specific, measurable outcomes, not vague goals.]

## Scope
**Included:** [What's covered]
**Not included:** [What's explicitly out of scope, to avoid later disputes]

## Approach & Timeline
| Phase | Description | Duration |
|-------|-------------|----------|
| [Phase 1] | [Description] | [Duration] |
| [Phase 2] | [Description] | [Duration] |
| [Phase 3] | [Description] | [Duration] |

## Budget
[Total cost, and how it's broken down — fixed fee, hourly, or milestone-based.]

## Deliverables
[Specific, concrete outputs — a list, not a description.]

## Next Steps
[What you need from the reader to move forward — a signature, a deposit, a kickoff date.]

*A proposal that's specific about scope and what's excluded prevents more disputes than one that sounds impressive but stays vague.*`,
  },
  {
    slug: "marketing-plan-template",
    name: "Marketing Plan",
    seoTitle: "Free Marketing Plan Template",
    description:
      "Free marketing plan template covering goals, target audience, channels, and budget for a product or campaign.",
    category: "Business",
    bodyMarkdown: `# Marketing Plan: [Product/Campaign Name]

## Goals
[Specific, measurable goals — e.g. "500 signups in Q2," not "grow awareness."]

## Target Audience
[Who exactly you're trying to reach — demographics, role, pain points, where they spend time online.]

## Positioning
[The one-sentence version of why this audience should care, and how it's different from alternatives.]

## Channels
| Channel | Purpose | Budget | Owner |
|---------|---------|--------|-------|
| [e.g. SEO/content] | [Why this channel] | [Budget] | [Who runs it] |
| [e.g. Paid social] | [Why this channel] | [Budget] | [Who runs it] |
| [e.g. Email] | [Why this channel] | [Budget] | [Who runs it] |

## Timeline
[Key dates — launch, campaign milestones, review points.]

## Success Metrics
[How you'll know it worked — the specific numbers you'll check against the goals above.]

## Budget Summary
**Total budget:** [Amount]
**Breakdown:** [By channel, as above]

*Revisit this plan against actual metrics on a fixed schedule (monthly is common) rather than only at the end — early signal is more useful than a postmortem.*`,
  },
  {
    slug: "request-for-proposal-template",
    name: "Request for Proposal (RFP)",
    seoTitle: "Free Request for Proposal (RFP) Template",
    description:
      "Free RFP template for soliciting competitive bids from vendors or contractors on a defined project.",
    category: "Business",
    bodyMarkdown: `# Request for Proposal: [Project Name]

**Issued by:** [Company Name]
**Date issued:** [Date]
**Proposal deadline:** [Date/Time]
**Contact:** [Name, Email]

## 1. Background
[Why you're issuing this RFP — the problem or need behind it.]

## 2. Scope of Work
[What you need done — be specific enough that vendors can price it accurately.]

## 3. Requirements
- [Requirement 1]
- [Requirement 2]
- [Requirement 3]

## 4. Timeline
| Milestone | Date |
|-----------|------|
| RFP issued | [Date] |
| Questions due | [Date] |
| Proposals due | [Date] |
| Vendor selected | [Date] |
| Project start | [Date] |

## 5. Proposal Format
Proposals should include: [e.g. company overview, relevant experience, approach, timeline, pricing, references].

## 6. Evaluation Criteria
Proposals will be evaluated on: [e.g. price (X%), experience (X%), approach (X%), references (X%)].

## 7. Submission
Submit proposals to [Contact/Email] by [Deadline]. Questions accepted until [Date].

*Specific requirements and clear evaluation criteria get you proposals that are actually comparable to each other — vague RFPs get vague, hard-to-compare bids back.*`,
  },
  {
    slug: "memorandum-of-understanding-template",
    name: "Memorandum of Understanding (MOU)",
    seoTitle: "Free Memorandum of Understanding (MOU) Template",
    description:
      "Free MOU template documenting a mutual understanding between two parties before a formal contract.",
    category: "Business",
    bodyMarkdown: `# Memorandum of Understanding

**Between:** [Party A Name]
**And:** [Party B Name]
**Date:** [Date]

This Memorandum of Understanding ("MOU") sets out the mutual understanding between the parties regarding [Purpose]. This MOU is intended to reflect good-faith intentions and, except where noted, is not legally binding.

## 1. Purpose
[Why the parties are entering this understanding — the shared goal.]

## 2. Roles and Responsibilities
**[Party A] will:** [List]
**[Party B] will:** [List]

## 3. Resources
[Any resources, funding, or personnel each party is contributing, if applicable.]

## 4. Duration
This MOU is effective from [Start Date] to [End Date], or until superseded by a formal agreement.

## 5. Confidentiality
[Optional: Both parties agree to keep shared information confidential during the term of this MOU.]

## 6. No Binding Obligation
Except for Section 5, nothing in this MOU creates a legally binding or enforceable obligation on either party.

---
[Party A]: ______________________  Date: ____________
[Party B]: ______________________  Date: ____________

*This document is provided for informational and educational purposes only and does not constitute legal advice. If you intend any part of this to be enforceable, say so explicitly and consult a licensed attorney.*`,
  },
  {
    slug: "employee-handbook-outline-template",
    name: "Employee Handbook Outline",
    seoTitle: "Free Employee Handbook Outline Template",
    description:
      "Free employee handbook outline template — the section structure a small business needs to get started.",
    category: "HR",
    bodyMarkdown: `# Employee Handbook: [Company Name]

## Welcome
[A short welcome note — company mission, values, and what this handbook covers.]

## 1. Employment Basics
- At-will employment statement (if applicable in your state)
- Equal opportunity employment statement
- Work hours and attendance expectations

## 2. Compensation & Benefits
- Pay schedule and method
- Overtime policy (if applicable)
- Benefits overview (health insurance, retirement, etc.)
- Paid time off / sick leave policy

## 3. Workplace Conduct
- Code of conduct
- Anti-harassment and non-discrimination policy
- Dress code (if any)
- Use of company equipment / acceptable use policy

## 4. Leave Policies
- Vacation and holidays
- Sick leave
- Parental/family leave
- Bereavement/jury duty leave

## 5. Performance & Discipline
- Performance review process
- Disciplinary process
- Termination procedures

## 6. Health & Safety
- Workplace safety expectations
- Emergency procedures
- Reporting incidents

## Acknowledgment
I have received and read the Employee Handbook and understand its contents.

Employee signature: ______________________  Date: ____________

*This is a section outline, not a complete handbook — actual policy language must comply with your specific state/local employment laws. Have a licensed employment attorney review the final version before distributing it.*`,
  },
  {
    slug: "one-way-nda-template",
    name: "One-Way (Unilateral) NDA",
    seoTitle: "Free One-Way (Unilateral) NDA Template",
    description:
      "Free one-way NDA template for when only one party is sharing confidential information — e.g. pitching to an investor or vendor.",
    category: "Legal",
    bodyMarkdown: `# One-Way (Unilateral) Non-Disclosure Agreement

**Disclosing Party:** [Name] (the "Disclosing Party")
**Receiving Party:** [Name] (the "Receiving Party")
**Date:** [Date]

The Disclosing Party may share certain confidential information with the Receiving Party for the purpose of [Purpose — e.g. "evaluating a potential investment"]. The parties agree as follows.

## 1. Confidential Information
Information disclosed by the Disclosing Party that is marked confidential, or that a reasonable person would understand to be confidential given the circumstances.

## 2. Obligations of Receiving Party
The Receiving Party will keep the Confidential Information confidential and use it only for the stated Purpose, using at least the same care it uses to protect its own confidential information.

## 3. Exclusions
This Agreement does not apply to information that: (a) is or becomes public through no fault of the Receiving Party; (b) the Receiving Party already knew before disclosure; (c) is independently developed without use of the Confidential Information; or (d) is required to be disclosed by law.

## 4. Term
This Agreement remains in effect for [Number] years from the date above, or until the information is no longer confidential under Section 3.

## 5. No License
Nothing in this Agreement grants the Receiving Party any rights to the Confidential Information beyond what's needed for the stated Purpose.

## 6. Governing Law
This Agreement is governed by the laws of [State/Country].

---
Disclosing Party: ______________________  Date: ____________
Receiving Party: ______________________  Date: ____________

*This document is provided for informational and educational purposes only and does not constitute legal advice. Consult a licensed attorney for a higher-stakes disclosure.*`,
  },
  {
    slug: "partnership-agreement-template",
    name: "Partnership Agreement",
    seoTitle: "Free Business Partnership Agreement Template",
    description:
      "Free general partnership agreement template covering ownership split, roles, profit sharing, and exit terms.",
    category: "Business",
    bodyMarkdown: `# General Partnership Agreement

**Partners:** [Partner A Name] and [Partner B Name] (together, the "Partners")
**Business Name:** [Business Name]
**Effective Date:** [Date]

## 1. Formation
The Partners form a general partnership under the laws of [State] to conduct the business of [Business Description].

## 2. Ownership & Capital Contributions
| Partner | Ownership % | Initial Contribution |
|---------|-------------|----------------------|
| [Partner A] | [%] | [Amount/Description] |
| [Partner B] | [%] | [Amount/Description] |

## 3. Roles and Responsibilities
**[Partner A] is responsible for:** [List]
**[Partner B] is responsible for:** [List]

## 4. Profit and Loss Sharing
Profits and losses are shared in proportion to ownership percentage, unless otherwise agreed in writing.

## 5. Decision-Making
[Describe — e.g. "Decisions on X require unanimous agreement; day-to-day decisions may be made by either Partner."]

## 6. Withdrawal or Death of a Partner
[Describe what happens to that partner's share — buyout terms, valuation method, timeline.]

## 7. Dispute Resolution
Disputes will first be addressed through good-faith discussion, then [mediation/arbitration] before litigation.

## 8. Dissolution
The partnership may be dissolved by mutual written agreement, or as otherwise required by law.

---
[Partner A]: ______________________  Date: ____________
[Partner B]: ______________________  Date: ____________

*This document is provided for informational and educational purposes only and does not constitute legal advice. Partnership law and liability exposure vary by state — consult a licensed attorney before forming a partnership.*`,
  },
  {
    slug: "consulting-agreement-template",
    name: "Consulting Agreement",
    seoTitle: "Free Consulting Agreement Template",
    description:
      "Free consulting agreement template for an independent consultant engagement — scope, fees, and IP terms.",
    category: "Business",
    bodyMarkdown: `# Consulting Agreement

**Client:** [Client Name]
**Consultant:** [Consultant Name]
**Effective Date:** [Date]

## 1. Services
The Consultant will provide the following services (the "Services"): [Describe scope of work specifically].

## 2. Term
This Agreement begins on [Start Date] and continues until [End Date / "the Services are complete"], unless terminated earlier under Section 6.

## 3. Fees
Client will pay Consultant [Rate — hourly/fixed/retainer], invoiced [Frequency], due within [Number] days of invoice.

## 4. Independent Contractor Status
The Consultant is an independent contractor, not an employee. The Consultant is responsible for their own taxes, insurance, and benefits.

## 5. Intellectual Property
[Choose one: "All work product created under this Agreement belongs to Client upon full payment." OR "Consultant retains ownership of pre-existing tools/methods used to deliver the Services."]

## 6. Termination
Either party may terminate this Agreement with [Notice Period] written notice. Client will pay for Services performed up to the termination date.

## 7. Confidentiality
Both parties agree to keep the other's confidential information private during and after the engagement.

## 8. Governing Law
This Agreement is governed by the laws of [State/Country].

---
Client: ______________________  Date: ____________
Consultant: ______________________  Date: ____________

*This document is provided for informational and educational purposes only and does not constitute legal advice. Worker-classification rules (contractor vs. employee) vary by jurisdiction — consult a licensed attorney if you're unsure which applies.*`,
  },
  {
    slug: "resignation-letter-template",
    name: "Resignation Letter",
    seoTitle: "Free Resignation Letter Template",
    description:
      "Free resignation letter template — a short, professional letter giving notice you're leaving a job.",
    category: "HR",
    bodyMarkdown: `# Resignation Letter

[Your Name]
[Date]

[Manager Name]
[Company Name]

Dear [Manager Name],

I am writing to formally resign from my position as [Job Title] at [Company Name], effective [Last Working Day].

[Optional: A brief, neutral reason — "to pursue a new opportunity" is enough; you don't owe more detail than you want to give.]

I'm committed to making this transition as smooth as possible and am happy to help hand off my responsibilities over the next [Notice Period].

Thank you for the opportunity to work here. I wish the team continued success.

Sincerely,
[Your Name]

*Two weeks' notice is common in the US but not legally required in most states; check your contract or employee handbook for any notice period you agreed to.*`,
  },
  {
    slug: "purchase-order-template",
    name: "Purchase Order",
    seoTitle: "Free Purchase Order (PO) Template",
    description:
      "Free purchase order template for ordering goods or services from a supplier, with itemized costs.",
    category: "Finance",
    bodyMarkdown: `# Purchase Order

**PO Number:** [PO Number]
**Date:** [Date]

**Buyer:** [Your Company Name / Address]
**Vendor:** [Vendor Name / Address]

## Ship To
[Delivery Address]

## Items Ordered

| Item # | Description | Quantity | Unit Price | Total |
|--------|-------------|----------|------------|-------|
| 1 | [Description] | [Qty] | [Price] | [Total] |
| 2 | [Description] | [Qty] | [Price] | [Total] |

**Subtotal:** [Amount]
**Tax:** [Amount]
**Shipping:** [Amount]
**Total:** [Amount]

## Terms
- Payment terms: [e.g. Net 30]
- Requested delivery date: [Date]
- Special instructions: [Any notes for the vendor]

---
Authorized by: ______________________  Date: ____________

*A purchase order becomes a binding contract once the vendor accepts it — keep a copy for your records and confirm receipt with the vendor before assuming the order is placed.*`,
  },
  {
    slug: "independent-contractor-agreement-template",
    name: "Independent Contractor Agreement",
    seoTitle: "Free Independent Contractor Agreement Template",
    description:
      "Free independent contractor agreement template — for hiring a 1099 contractor, covering scope, pay, and IP.",
    category: "Business",
    bodyMarkdown: `# Independent Contractor Agreement

**Client:** [Client Name]
**Contractor:** [Contractor Name]
**Effective Date:** [Date]

## 1. Services
Contractor will perform the following services: [Describe scope of work].

## 2. Payment
Client will pay Contractor [Rate — hourly/fixed/project], due [Payment Terms, e.g. "within 15 days of invoice"].

## 3. Independent Contractor Status
Contractor is not an employee of Client. Contractor is responsible for their own taxes (no withholding by Client), insurance, equipment, and work schedule. Nothing in this Agreement creates an employment, partnership, or agency relationship.

## 4. Term and Termination
This Agreement runs from [Start Date] until [End Date / completion of the Services], and may be terminated earlier by either party with [Notice Period] written notice.

## 5. Intellectual Property
Upon full payment, all work product created specifically for this engagement belongs to Client. Contractor retains rights to any pre-existing tools, code, or materials used to deliver the work.

## 6. Confidentiality
Contractor will keep Client's confidential information private during and after the engagement.

## 7. No Exclusivity
Unless stated otherwise, Contractor is free to perform services for other clients during the term of this Agreement.

## 8. Governing Law
This Agreement is governed by the laws of [State/Country].

---
Client: ______________________  Date: ____________
Contractor: ______________________  Date: ____________

*This document is provided for informational and educational purposes only and does not constitute legal advice. Worker misclassification (treating an employee as a contractor) carries real penalties — confirm the relationship actually qualifies under your state/country's test before using this template.*`,
  },
  {
    slug: "corporate-bylaws-template",
    name: "Corporate Bylaws",
    seoTitle: "Free Corporate Bylaws Template",
    description:
      "Free corporate bylaws template — the internal governance rules for a new corporation's board and shareholders.",
    category: "Legal",
    bodyMarkdown: `# Bylaws of [Company Name]

## Article 1: Offices
The corporation's principal office is located at [Address]. The corporation may have other offices as the board determines.

## Article 2: Shareholders
Annual shareholder meetings are held [Timing, e.g. "in the second quarter of each fiscal year"]. Special meetings may be called by [the Board / holders of at least X% of shares]. Notice must be given at least [Number] days in advance.

## Article 3: Board of Directors
The board consists of [Number] director(s), elected annually by shareholders. The board manages the corporation's business and affairs and may act by majority vote at a meeting, or by unanimous written consent.

## Article 4: Officers
The corporation's officers are: [President/CEO, Secretary, Treasurer/CFO — describe duties briefly]. Officers are appointed by the board and serve at its discretion.

## Article 5: Stock
The corporation is authorized to issue [Number] shares of [Class] stock. Shares are transferable per [State] law and any shareholder agreement then in effect.

## Article 6: Indemnification
The corporation will indemnify directors and officers to the fullest extent permitted by [State] law for actions taken in good faith on the corporation's behalf.

## Article 7: Amendments
These Bylaws may be amended by [board resolution / shareholder vote of X%].

---
Adopted by the Board of Directors on [Date].
Secretary signature: ______________________

*This document is provided for informational and educational purposes only and does not constitute legal advice. Bylaw requirements vary by state — have a licensed attorney review the final version before adoption.*`,
  },
  {
    slug: "articles-of-incorporation-template",
    name: "Articles of Incorporation",
    seoTitle: "Free Articles of Incorporation Template",
    description:
      "Free articles of incorporation template — the founding document filed with the state to form a corporation.",
    category: "Legal",
    bodyMarkdown: `# Articles of Incorporation of [Company Name]

## Article 1: Name
The name of the corporation is [Company Name, Inc.].

## Article 2: Registered Agent
The corporation's registered agent is [Agent Name], located at [Registered Agent Address] in the State of [State].

## Article 3: Purpose
The corporation is organized to engage in any lawful business activity for which corporations may be organized under [State] law.

## Article 4: Authorized Shares
The corporation is authorized to issue [Number] shares of [Class, e.g. "common stock"], with a par value of [Amount] per share.

## Article 5: Incorporator
The name and address of the incorporator is: [Name, Address].

## Article 6: Directors (if required by your state)
The initial director(s): [Name(s) and address(es)].

---
Executed by the incorporator on [Date].
Signature: ______________________
[Incorporator Name]

*This is a template only, not a substitute for your state's official filing form. Requirements (registered agent rules, franchise tax, required articles) vary significantly by state — file using your Secretary of State's actual form, and consult a licensed attorney if your structure is anything but simple.*`,
  },
  {
    slug: "meeting-minutes-template",
    name: "Meeting Minutes",
    seoTitle: "Free Meeting Minutes Template",
    description:
      "Free meeting minutes template for a board, team, or shareholder meeting — attendees, decisions, and action items.",
    category: "Business",
    bodyMarkdown: `# Meeting Minutes

**Meeting:** [Meeting Name/Type]
**Date:** [Date]
**Time:** [Start Time] – [End Time]
**Location:** [Location / video call link]

## Attendees
[List of attendees]

**Absent:** [List, if relevant]

## Agenda Items

### 1. [Agenda Item]
[Discussion summary — key points, not a full transcript]
**Decision:** [What was decided, if anything]

### 2. [Agenda Item]
[Discussion summary]
**Decision:** [What was decided, if anything]

## Action Items

| Action | Owner | Due Date |
|--------|-------|----------|
| [Action] | [Name] | [Date] |
| [Action] | [Name] | [Date] |

## Next Meeting
[Date/time of next meeting, if scheduled]

---
Minutes recorded by: [Name]

*For board/shareholder meetings that need to be legally sufficient (e.g. for corporate record-keeping), confirm the level of detail your state or bylaws require — some jurisdictions expect votes and quorum to be explicitly recorded.*`,
  },
  {
    slug: "joint-venture-agreement-template",
    name: "Joint Venture Agreement",
    seoTitle: "Free Joint Venture Agreement Template",
    description:
      "Free joint venture agreement template for two businesses partnering on a specific project without forming a new company.",
    category: "Business",
    bodyMarkdown: `# Joint Venture Agreement

**Party A:** [Company/Individual A]
**Party B:** [Company/Individual B]
**Effective Date:** [Date]

## 1. Purpose
The parties agree to jointly undertake the following project: [Project Description] (the "Venture"), while each remaining a separate, independent entity.

## 2. Contributions
**Party A will contribute:** [Capital, resources, expertise, etc.]
**Party B will contribute:** [Capital, resources, expertise, etc.]

## 3. Profit and Loss Sharing
Profits and losses from the Venture are shared: Party A [%], Party B [%].

## 4. Management
[Describe how decisions about the Venture are made — jointly, by a designated lead, or by a management committee.]

## 5. Term
This Agreement continues until [the Venture is complete / a fixed end date], unless ended earlier by mutual agreement.

## 6. Liability
Each party remains responsible for its own obligations and is not liable for the other's separate business activities outside the Venture, except as expressly agreed here.

## 7. Confidentiality
Both parties will keep information shared for the Venture confidential, both during and after its term.

## 8. Dispute Resolution
Disputes will be addressed through good-faith negotiation, then [mediation/arbitration] before litigation.

---
[Party A]: ______________________  Date: ____________
[Party B]: ______________________  Date: ____________

*This document is provided for informational and educational purposes only and does not constitute legal advice. Joint ventures can create shared liability depending on how they're structured — consult a licensed attorney before entering one.*`,
  },
  {
    slug: "purchase-agreement-template",
    name: "Purchase Agreement (Goods or Assets)",
    seoTitle: "Free Purchase Agreement Template",
    description:
      "Free purchase agreement template for buying or selling goods, equipment, or business assets outside of a simple invoice.",
    category: "Business",
    bodyMarkdown: `# Purchase Agreement

**Seller:** [Seller Name]
**Buyer:** [Buyer Name]
**Date:** [Date]

## 1. Item(s) Sold
Seller agrees to sell, and Buyer agrees to buy, the following: [Detailed description of goods/assets, including condition — e.g. "as-is" — and any serial/identification numbers].

## 2. Purchase Price
The total purchase price is [Amount], payable as: [Full payment on signing / deposit of [Amount] with balance due on delivery / installments — describe].

## 3. Delivery
[Description of delivery — date, location, method, and who pays shipping/transport costs.]

## 4. Condition and Warranties
[Choose one: "Item(s) are sold as-is, with no warranties of any kind." OR describe specific warranties made by Seller.]

## 5. Risk of Loss
Risk of loss or damage transfers to Buyer upon [delivery / payment in full — specify].

## 6. Title
Seller confirms they have the legal right to sell the item(s) and that they are free of liens or encumbrances, unless otherwise disclosed: [Disclose any liens, if applicable].

## 7. Governing Law
This Agreement is governed by the laws of [State/Country].

---
Seller: ______________________  Date: ____________
Buyer: ______________________  Date: ____________

*This document is provided for informational and educational purposes only and does not constitute legal advice. For real estate, vehicles, or high-value assets, additional state-specific disclosures or title transfer paperwork may be legally required — confirm what applies before relying on this template alone.*`,
  },
  {
    slug: "license-agreement-template",
    name: "License Agreement",
    seoTitle: "Free License Agreement Template",
    description:
      "Free license agreement template for granting someone else the right to use your intellectual property, software, or content.",
    category: "Legal",
    bodyMarkdown: `# License Agreement

**Licensor:** [Licensor Name] (the "Licensor")
**Licensee:** [Licensee Name] (the "Licensee")
**Effective Date:** [Date]

## 1. Grant of License
Licensor grants Licensee a [exclusive/non-exclusive], [transferable/non-transferable] license to use [Description of the IP — e.g. software, trademark, content, patent] (the "Licensed Property") for the following purpose: [Purpose].

## 2. Territory and Term
This license applies to [Territory, e.g. "worldwide" or a specific country/region] for a term of [Duration], starting on the Effective Date.

## 3. Fees
Licensee will pay Licensor [Flat fee / royalty rate, e.g. "X% of net revenue from products using the Licensed Property"], payable [Frequency].

## 4. Restrictions
Licensee may not: [e.g. sublicense without consent, modify the Licensed Property beyond what's agreed, use it outside the stated purpose].

## 5. Ownership
Licensor retains all ownership rights in the Licensed Property. This Agreement grants only a license to use it, not an assignment of ownership.

## 6. Termination
Either party may terminate this Agreement with [Notice Period] written notice, or immediately if the other party materially breaches its terms and fails to cure within [Cure Period].

## 7. Governing Law
This Agreement is governed by the laws of [State/Country].

---
Licensor: ______________________  Date: ____________
Licensee: ______________________  Date: ____________

*This document is provided for informational and educational purposes only and does not constitute legal advice. IP licensing terms (especially royalty structure and exclusivity) are often heavily negotiated — consult a licensed attorney for anything beyond a simple, low-value license.*`,
  },
  {
    slug: "statement-of-work-template",
    name: "Statement of Work (SOW)",
    seoTitle: "Free Statement of Work (SOW) Template",
    description:
      "Free statement of work template defining deliverables, timeline, and payment for a specific project under a master agreement.",
    category: "Business",
    bodyMarkdown: `# Statement of Work

**Client:** [Client Name]
**Provider:** [Provider Name]
**SOW Number:** [Number]
**Effective Date:** [Date]
**Related Agreement:** [Reference to the master services/consulting agreement this SOW falls under, if any]

## 1. Project Overview
[One or two sentences on what this project is and why.]

## 2. Deliverables
| Deliverable | Description | Due Date |
|-------------|-------------|----------|
| [Deliverable 1] | [Description] | [Date] |
| [Deliverable 2] | [Description] | [Date] |

## 3. Timeline
Project start: [Date]
Project completion: [Date]

## 4. Acceptance Criteria
[How each deliverable will be reviewed and accepted — e.g. "Client has 5 business days to request revisions before a deliverable is deemed accepted."]

## 5. Fees and Payment Schedule
| Milestone | Amount | Due |
|-----------|--------|-----|
| [Milestone 1] | [Amount] | [Date/trigger] |
| [Milestone 2] | [Amount] | [Date/trigger] |

## 6. Assumptions and Exclusions
[What's explicitly NOT included, and any assumptions this SOW relies on — e.g. "Client will provide access to X by [date]."]

## 7. Change Control
Any change to scope, timeline, or fees requires a written change order signed by both parties.

---
Client: ______________________  Date: ____________
Provider: ______________________  Date: ____________

*A SOW works best alongside a separate master agreement covering IP, confidentiality, and liability — this document is meant to define scope and deliverables, not replace those broader terms.*`,
  },
  {
    slug: "business-proposal-template",
    name: "Business Proposal",
    seoTitle: "Free Business Proposal Template",
    description:
      "Free business proposal template for pitching your product or service to a potential client.",
    category: "Business",
    bodyMarkdown: `# Business Proposal: [Your Company] for [Client Name]

**Prepared by:** [Your Name/Company]
**Date:** [Date]

## Executive Summary
[One paragraph: who you are, what you're proposing, and the key benefit to the client.]

## Understanding Your Needs
[Show you understand the client's specific situation — what problem they're trying to solve.]

## Proposed Solution
[What you're offering and how it solves the problem above — be concrete.]

## Why Us
[Relevant experience, past results, or differentiators — real, specific examples, not generic claims.]

## Pricing
| Package/Item | Description | Price |
|---------------|-------------|-------|
| [Item] | [Description] | [Price] |

## Timeline
[Key milestones from kickoff to completion.]

## Terms
[Payment terms, contract length, and anything else the client needs to know before signing.]

## Next Steps
To move forward, [sign the attached agreement / reply to confirm / schedule a call] by [Date].

*A proposal that leads with the client's problem (not your company's history) tends to convert better — save the "About Us" section for the end, briefly.*`,
  },
  {
    slug: "rental-application-template",
    name: "Rental Application",
    seoTitle: "Free Rental Application Template",
    description:
      "Free rental application template for landlords screening prospective tenants — income, rental history, and references.",
    category: "Real Estate",
    bodyMarkdown: `# Rental Application

**Property Address:** [Address]
**Monthly Rent:** [Amount]
**Desired Move-in Date:** [Date]

## Applicant Information
Full Name: [Name]
Date of Birth: [Date]
Phone: [Phone] · Email: [Email]
Current Address: [Address]
Reason for moving: [Reason]

## Employment & Income
Employer: [Employer Name]
Position: [Job Title]
Monthly income: [Amount]
Employer contact (for verification): [Phone/Email]

## Rental History
Current landlord: [Name/Contact]
Length of current tenancy: [Duration]
Previous landlord (if under 2 years at current address): [Name/Contact]

## Additional Occupants
[List anyone else who will live at the property]

## Pets
[Yes/No — type, breed, weight if applicable]

## References
1. [Name, relationship, contact]
2. [Name, relationship, contact]

## Authorization
I authorize the landlord to verify the information above, including a credit and background check.

Applicant signature: ______________________  Date: ____________

*Fair housing law prohibits screening criteria based on protected characteristics (race, religion, familial status, disability, etc.) — apply the same questions and standards to every applicant.*`,
  },
  {
    slug: "certificate-of-completion-template",
    name: "Certificate of Completion",
    seoTitle: "Free Certificate of Completion Template",
    description:
      "Free certificate of completion template for a training program, course, or project milestone.",
    category: "Business",
    bodyMarkdown: `# Certificate of Completion

This certifies that

## [Recipient Name]

has successfully completed

**[Course/Program/Project Name]**

on [Completion Date]

[Optional: brief description of what the program covered, or hours completed — e.g. "40 hours of on-the-job safety training."]

---
[Issuing Organization Name]
Issued by: ______________________
[Signatory Name, Title]
Date: [Date]

*Add your logo and adjust the layout for print if this is meant to be framed or displayed — the wording above works either as a printed certificate or a simple digital confirmation.*`,
  },
  {
    slug: "letter-of-invitation-template",
    name: "Letter of Invitation",
    seoTitle: "Free Letter of Invitation Template",
    description:
      "Free letter of invitation template for inviting someone to an event, conference, or (for visa purposes) a visit.",
    category: "Business",
    bodyMarkdown: `# Letter of Invitation

[Your Name / Organization]
[Your Address]
[Date]

**RE: Invitation for [Invitee Name]**

Dear [Recipient Name / "Visa Officer"],

I am writing to formally invite [Invitee Name] to [attend Event Name / visit me in Country] from [Start Date] to [End Date].

## Purpose of Visit
[Describe the event, business meeting, or personal visit clearly and specifically.]

## Relationship / Context
[How you know the invitee, or their role at the event — relevant especially for visa-support letters.]

## Details
- Location: [Address/Venue]
- Dates: [Start Date] – [End Date]
- [If applicable: Accommodation/financial support arrangements]

## Contact Information
[Your phone, email, and address for any follow-up questions.]

Sincerely,
[Your Name]
[Title/Organization, if applicable]

*If this letter supports a visa application, check the destination country's specific requirements (notarization, exact wording, supporting documents) before sending — requirements vary by country and visa type.*`,
  },
  {
    slug: "letter-of-recommendation-template",
    name: "Letter of Recommendation",
    seoTitle: "Free Letter of Recommendation Template",
    description: "Free letter of recommendation template for a former employee, student, or colleague.",
    category: "HR",
    bodyMarkdown: `# Letter of Recommendation

[Your Name]
[Your Title/Organization]
[Date]

**RE: Recommendation for [Candidate Name]**

Dear [Recipient Name / "Hiring Manager"],

I am writing to recommend [Candidate Name] for [position/program/opportunity]. I worked with [Candidate Name] as their [your relationship — manager, colleague, professor] at [Company/Institution] for [Duration].

## Why I'm recommending them
[One or two specific examples of their work, skills, or character — concrete achievements, not generic praise.]

## Their strengths
[2-3 specific strengths relevant to what they're applying for.]

I recommend [Candidate Name] without reservation and am happy to answer any further questions.

Sincerely,
[Your Name]
[Contact Information]

*A recommendation with specific, concrete examples carries far more weight than generic praise — take the time to include at least one real story or result.*`,
  },
  {
    slug: "letter-of-agreement-template",
    name: "Letter of Agreement",
    seoTitle: "Free Letter of Agreement Template",
    description: "Free letter of agreement template — a simple, letter-format contract for a straightforward arrangement.",
    category: "Business",
    bodyMarkdown: `# Letter of Agreement

[Date]

[Party B Name]
[Party B Address]

Dear [Party B Name],

This letter confirms the agreement between [Party A Name] ("Party A") and [Party B Name] ("Party B") regarding [Subject of Agreement].

## Terms
1. [Term 1 — e.g. what will be delivered or done]
2. [Term 2 — e.g. payment amount and schedule]
3. [Term 3 — e.g. timeline]
4. [Term 4 — e.g. what happens if either party doesn't follow through]

If these terms are acceptable, please sign and return a copy of this letter to confirm your agreement.

Sincerely,
[Party A Name]

---
Agreed and accepted:
[Party B Name]: ______________________  Date: ____________

*A letter of agreement works well for straightforward, lower-stakes arrangements. For anything with significant money or risk involved, a full contract reviewed by an attorney is safer.*`,
  },
  {
    slug: "meeting-agenda-template",
    name: "Meeting Agenda",
    seoTitle: "Free Meeting Agenda Template",
    description: "Free meeting agenda template to keep a meeting focused and on time.",
    category: "Business",
    bodyMarkdown: `# Meeting Agenda

**Meeting:** [Meeting Name]
**Date:** [Date] · **Time:** [Start] – [End]
**Location:** [Location / call link]
**Attendees:** [List]

## Objective
[One sentence: what this meeting needs to accomplish.]

## Agenda

| # | Topic | Owner | Time |
|---|-------|-------|------|
| 1 | [Topic] | [Name] | [X min] |
| 2 | [Topic] | [Name] | [X min] |
| 3 | [Topic] | [Name] | [X min] |

## Pre-reading
[Any documents attendees should review beforehand, if applicable.]

## Notes
[Space to jot decisions/action items during the meeting, or move to a separate meeting-minutes doc.]

*Sending the agenda at least a day ahead, with time estimates per topic, is what actually keeps a meeting on schedule — the format alone won't do it.*`,
  },
  {
    slug: "business-memo-template",
    name: "Business Memo",
    seoTitle: "Free Business Memo Template",
    description: "Free business memo template for internal announcements, updates, or requests.",
    category: "Business",
    bodyMarkdown: `# Memorandum

**To:** [Recipient(s)]
**From:** [Your Name]
**Date:** [Date]
**Re:** [Subject]

## Purpose
[One sentence: why this memo exists.]

## Background
[Brief context, if the reader needs it.]

## Details
[The actual content — announcement, update, or request, in as few words as does the job.]

## Action Needed
[What, if anything, the reader needs to do, and by when.]

*Lead with the point in the first sentence — a memo that makes the reader hunt for the actual news gets skimmed, not read.*`,
  },
  {
    slug: "income-statement-template",
    name: "Income Statement",
    seoTitle: "Free Income Statement (P&L) Template",
    description: "Free income statement (profit & loss) template for tracking revenue, expenses, and net income over a period.",
    category: "Finance",
    bodyMarkdown: `# Income Statement — [Company Name]

**Period:** [Start Date] – [End Date]

## Revenue
| Line Item | Amount |
|-----------|--------|
| [Revenue source 1] | [Amount] |
| [Revenue source 2] | [Amount] |
| **Total Revenue** | **[Amount]** |

## Cost of Goods Sold (COGS)
| Line Item | Amount |
|-----------|--------|
| [COGS item] | [Amount] |
| **Total COGS** | **[Amount]** |

**Gross Profit** = Total Revenue − Total COGS = **[Amount]**

## Operating Expenses
| Line Item | Amount |
|-----------|--------|
| [Rent/salaries/marketing/etc.] | [Amount] |
| **Total Operating Expenses** | **[Amount]** |

**Operating Income** = Gross Profit − Total Operating Expenses = **[Amount]**

## Other Income/Expenses
[Interest, taxes, one-time items]

**Net Income** = **[Amount]**

*This is a simplified format for a small business. If you need this for a loan application, investor, or tax filing, have a bookkeeper or accountant review it against your actual books.*`,
  },
  {
    slug: "expense-report-template",
    name: "Expense Report",
    seoTitle: "Free Expense Report Template",
    description: "Free expense report template for tracking and submitting business expenses over a period.",
    category: "Finance",
    bodyMarkdown: `# Expense Report

**Employee:** [Name]
**Period:** [Start Date] – [End Date]
**Department:** [Department]

| Date | Description | Category | Amount | Payment Method |
|------|-------------|----------|--------|-----------------|
| [Date] | [Description] | [Travel/Meals/Supplies/etc.] | [Amount] | [Personal card/Company card] |
| [Date] | [Description] | [Category] | [Amount] | [Method] |

**Total: [Amount]**

## Notes
[Business purpose, client/project code, or anything the approver needs to know.]

## Approval
Submitted by: ______________________  Date: ____________
Approved by: ______________________  Date: ____________

*Attach receipts for anything over your company's threshold (commonly $25-75) — most expense policies require it for reimbursement.*`,
  },
  {
    slug: "startup-business-plan-template",
    name: "Startup Business Plan",
    seoTitle: "Free Startup Business Plan Template",
    description: "Free multi-section startup business plan template — more detailed than a one-pager, for a bank loan or investor.",
    category: "Business",
    bodyMarkdown: `# Business Plan: [Company Name]

## 1. Executive Summary
[One-page overview — see docstoc's Executive Summary template for a standalone version of this section.]

## 2. Company Description
[Legal structure, location, mission, and history if any.]

## 3. Market Analysis
[Target market size, customer segments, competitive landscape.]

## 4. Organization & Management
[Ownership structure, key team members and their roles.]

## 5. Products or Services
[What you sell, and what makes it different from alternatives.]

## 6. Marketing & Sales Strategy
[How you'll reach customers and convert them — channels, pricing, positioning.]

## 7. Financial Projections
[Revenue projections, break-even analysis, and funding needed, if any. Use real assumptions you can defend, not optimistic guesses.]

## 8. Funding Request (if applicable)
[Amount needed, use of funds, and terms sought.]

## Appendix
[Supporting documents — resumes, licenses, market research, letters of intent.]

*Lenders and investors read the executive summary and financials closely and skim the rest — make sure those two sections are airtight even if other sections stay brief.*`,
  },
  {
    slug: "informed-consent-form-template",
    name: "Informed Consent Form",
    seoTitle: "Free Informed Consent Form Template",
    description: "Free informed consent form template for a research study, medical procedure, or service involving risk.",
    category: "Legal",
    bodyMarkdown: `# Informed Consent Form

**Study/Procedure/Service:** [Name]
**Conducted by:** [Provider/Researcher Name]

## Purpose
[What this is, and why the participant is being asked to take part.]

## What Will Happen
[Describe the procedure, study activities, or service in plain language.]

## Risks and Benefits
**Risks:** [Describe honestly — even minor ones]
**Benefits:** [Describe realistically — avoid overstating]

## Confidentiality
[How the participant's information will be used, stored, and protected.]

## Voluntary Participation
Participation is voluntary. You may withdraw at any time without penalty.

## Questions
Contact [Name/Email/Phone] with any questions before or after signing.

## Consent
I have read and understood the above and voluntarily agree to participate.

Participant signature: ______________________  Date: ____________
[If applicable] Witness signature: ______________________  Date: ____________

*Consent form requirements are heavily regulated for medical and research settings (e.g. IRB approval, HIPAA) — this is a general template only; consult your institution's compliance office or a licensed attorney for anything regulated.*`,
  },
  {
    slug: "cash-flow-statement-template",
    name: "Cash Flow Statement",
    seoTitle: "Free Cash Flow Statement Template",
    description: "Free cash flow statement template tracking cash in and out of the business over a period.",
    category: "Finance",
    bodyMarkdown: `# Cash Flow Statement — [Company Name]

**Period:** [Start Date] – [End Date]

## Operating Activities
| Item | Amount |
|------|--------|
| Cash received from customers | [Amount] |
| Cash paid to suppliers/employees | [Amount] |
| **Net Cash from Operating Activities** | **[Amount]** |

## Investing Activities
| Item | Amount |
|------|--------|
| Purchase/sale of equipment or assets | [Amount] |
| **Net Cash from Investing Activities** | **[Amount]** |

## Financing Activities
| Item | Amount |
|------|--------|
| Loan proceeds/repayments | [Amount] |
| Owner contributions/distributions | [Amount] |
| **Net Cash from Financing Activities** | **[Amount]** |

## Summary
Net change in cash: **[Amount]**
Cash at start of period: **[Amount]**
Cash at end of period: **[Amount]**

*A business can be profitable on paper (income statement) and still run out of cash — this statement is what actually tells you if you can pay your bills.*`,
  },
  {
    slug: "medical-release-form-template",
    name: "Medical Release Form",
    seoTitle: "Free Medical Release Form Template",
    description: "Free medical release form template authorizing treatment or release of medical information for a minor or dependent.",
    category: "Legal",
    bodyMarkdown: `# Medical Release Form

**Child/Dependent Name:** [Name]
**Date of Birth:** [Date]
**Parent/Guardian:** [Name]

I, [Parent/Guardian Name], authorize [Caregiver/Organization Name] to:

- Seek emergency medical treatment for the above-named individual if I cannot be reached
- Release relevant medical information to treating medical professionals as needed

## Emergency Contacts
1. [Name, Phone, Relationship]
2. [Name, Phone, Relationship]

## Medical Information
Known allergies: [List, or "None"]
Current medications: [List, or "None"]
Physician: [Name, Phone]
Insurance provider/policy #: [Details]

## Authorization Period
This authorization is valid from [Start Date] to [End Date].

Parent/Guardian signature: ______________________  Date: ____________

*This is a general-purpose template (camps, schools, sports teams, caregivers) — some states/organizations require notarization or a specific form. Confirm with the organization requesting it.*`,
  },
  {
    slug: "commercial-invoice-template",
    name: "Commercial Invoice",
    seoTitle: "Free Commercial Invoice Template",
    description: "Free commercial invoice template for international shipments — the customs-required version of a standard invoice.",
    category: "Finance",
    bodyMarkdown: `# Commercial Invoice

**Invoice #:** [Number] · **Date:** [Date]

**Shipper/Exporter:** [Name, Address]
**Consignee/Importer:** [Name, Address]

## Shipment Details
Country of origin: [Country]
Country of destination: [Country]
Terms of sale (Incoterms): [e.g. FOB, CIF, DDP]
Currency: [Currency]

## Goods

| Description | HS Code | Qty | Unit Price | Total | Country of Origin |
|-------------|---------|-----|-------------|-------|---------------------|
| [Description] | [Code] | [Qty] | [Price] | [Total] | [Country] |

**Total Value: [Amount] [Currency]**

## Declaration
I declare that the information on this invoice is true and correct.

Signature: ______________________  Date: ____________
[Name, Title]

*Customs requirements (HS codes, required declarations, number of copies) vary by country — check the destination country's customs authority or your freight forwarder before shipping.*`,
  },
  {
    slug: "personal-statement-template",
    name: "Personal Statement",
    seoTitle: "Free Personal Statement Template",
    description: "Free personal statement template for a school, scholarship, or program application.",
    category: "Business",
    bodyMarkdown: `# Personal Statement

## Opening
[A specific moment, experience, or realization that connects to why you're applying — not a generic opening line.]

## Your story
[What led you here — relevant experiences, challenges overcome, or work that shaped your interest in this field/program.]

## Why this program/opportunity
[Specific reasons this particular program or opportunity fits your goals — shows you did the research.]

## Your goals
[What you plan to do with this opportunity, and how it fits your longer-term direction.]

## Closing
[Tie it back to your opening, and end with a clear, confident statement of fit.]

*The strongest personal statements are specific and honest rather than trying to sound impressive — one real, well-told story beats five generic accomplishments listed out.*`,
  },
  {
    slug: "severance-agreement-template",
    name: "Severance Agreement",
    seoTitle: "Free Severance Agreement Template",
    description: "Free severance agreement template for an employee departure, including severance pay and release of claims.",
    category: "HR",
    bodyMarkdown: `# Severance Agreement and Release

**Employer:** [Company Name]
**Employee:** [Employee Name]
**Date:** [Date]

## 1. Separation
Employee's employment with the Company ends on [Date] (the "Separation Date").

## 2. Severance Pay
In exchange for the release below, the Company will pay Employee [Amount/Formula], less applicable withholdings, paid [Lump sum / over X pay periods].

## 3. Benefits
[Describe continuation of health insurance (e.g. COBRA), if applicable, and its duration.]

## 4. Release of Claims
In exchange for the severance pay above, Employee releases the Company from any claims related to their employment or its termination, to the fullest extent permitted by law.

## 5. Confidentiality and Non-Disparagement
[Optional: both parties agree not to disparage each other, and to keep the terms of this Agreement confidential.]

## 6. Return of Property
Employee will return all Company property (equipment, keys, access badges, confidential materials) by the Separation Date.

## 7. Revocation Period
[If required in your jurisdiction, e.g. under the US Older Workers Benefit Protection Act: "Employee has 21 days to consider this Agreement and 7 days after signing to revoke it."]

---
Employer: ______________________  Date: ____________
Employee: ______________________  Date: ____________

*This document is provided for informational and educational purposes only and does not constitute legal advice. Severance/release agreements have specific legal requirements (especially for age-protected employees) — have a licensed employment attorney review before offering or signing one.*`,
  },
  {
    slug: "indemnification-agreement-template",
    name: "Indemnification Agreement",
    seoTitle: "Free Indemnification Agreement Template",
    description: "Free indemnification agreement template — one party agrees to cover losses the other incurs from specified risks.",
    category: "Legal",
    bodyMarkdown: `# Indemnification Agreement

**Indemnifying Party:** [Name] (the "Indemnitor")
**Indemnified Party:** [Name] (the "Indemnitee")
**Date:** [Date]

## 1. Indemnification
The Indemnitor agrees to indemnify, defend, and hold harmless the Indemnitee from any claims, losses, damages, or expenses (including reasonable attorney's fees) arising from: [Describe the specific activity/risk — e.g. "the Indemnitor's performance of services under the attached agreement"].

## 2. Exclusions
This indemnification does not apply to claims arising from the Indemnitee's own negligence or willful misconduct.

## 3. Notice and Defense
The Indemnitee will promptly notify the Indemnitor of any claim, and the Indemnitor may control the defense of that claim using counsel of its choice, subject to the Indemnitee's reasonable approval.

## 4. Term
This indemnification survives for [Duration] after [the underlying agreement ends / the event described above].

## 5. Governing Law
This Agreement is governed by the laws of [State/Country].

---
Indemnitor: ______________________  Date: ____________
Indemnitee: ______________________  Date: ____________

*This document is provided for informational and educational purposes only and does not constitute legal advice. Indemnification scope is often heavily negotiated in real contracts — consult a licensed attorney for anything beyond a low-stakes arrangement.*`,
  },
  {
    slug: "security-agreement-template",
    name: "Security Agreement",
    seoTitle: "Free Security Agreement Template",
    description: "Free security agreement template — pledges collateral to secure a loan or other obligation.",
    category: "Finance",
    bodyMarkdown: `# Security Agreement

**Debtor:** [Name] (the "Debtor")
**Secured Party:** [Name] (the "Secured Party")
**Date:** [Date]

## 1. Grant of Security Interest
To secure repayment of [Reference the underlying loan/promissory note], Debtor grants Secured Party a security interest in the following collateral: [Describe collateral specifically — e.g. equipment, inventory, accounts receivable].

## 2. Obligations Secured
This security interest secures [Amount] owed under [Reference document, e.g. "the Promissory Note dated ___"], plus interest and any costs of enforcement.

## 3. Debtor's Representations
Debtor represents that it owns the collateral free of other liens, except as disclosed: [Disclose any existing liens].

## 4. Default
Debtor is in default if: [payment is missed, the collateral is damaged/sold without consent, etc.]. Upon default, Secured Party may exercise all rights available under [State] law, including repossession of the collateral.

## 5. Filing
Secured Party may file a UCC-1 financing statement to perfect this security interest.

## 6. Governing Law
This Agreement is governed by the laws of [State/Country].

---
Debtor: ______________________  Date: ____________
Secured Party: ______________________  Date: ____________

*This document is provided for informational and educational purposes only and does not constitute legal advice. Perfecting a security interest correctly (UCC filings, priority rules) is technical — consult a licensed attorney for any loan of real size.*`,
  },
  {
    slug: "deed-of-trust-template",
    name: "Deed of Trust",
    seoTitle: "Free Deed of Trust Template",
    description: "Free deed of trust template — secures a real estate loan using a neutral trustee (used instead of a mortgage in some states).",
    category: "Real Estate",
    bodyMarkdown: `# Deed of Trust

**Trustor (Borrower):** [Name]
**Trustee:** [Name — often a title company]
**Beneficiary (Lender):** [Name]
**Property:** [Legal description/address]
**Date:** [Date]

## 1. Conveyance in Trust
Trustor conveys the Property to Trustee, in trust, with power of sale, to secure repayment of the debt described below.

## 2. Secured Debt
This Deed of Trust secures repayment of [Amount] under a Promissory Note dated [Date], plus interest, according to its terms.

## 3. Trustor's Covenants
Trustor agrees to: maintain the property, keep it insured, pay property taxes when due, and not transfer the property without Beneficiary's consent (or as otherwise permitted).

## 4. Default and Power of Sale
If Trustor defaults on the underlying debt, Beneficiary may direct Trustee to sell the Property through the non-judicial foreclosure process available under [State] law.

## 5. Reconveyance
Once the debt is paid in full, Beneficiary will direct Trustee to reconvey the Property to Trustor, free of this Deed of Trust.

---
Trustor: ______________________  Date: ____________
[Notarization block — required in essentially all states for this document]

*This document is provided for informational and educational purposes only and does not constitute legal advice. Deed of trust vs. mortgage rules, notarization, and recording requirements vary significantly by state — this must be prepared and recorded correctly to be enforceable. Use a title company or real estate attorney.*`,
  },
  {
    slug: "credit-card-authorization-form-template",
    name: "Credit Card Authorization Form",
    seoTitle: "Free Credit Card Authorization Form Template",
    description: "Free credit card authorization form template for a customer to approve a one-time or recurring charge.",
    category: "Finance",
    bodyMarkdown: `# Credit Card Authorization Form

**Business Name:** [Your Business Name]
**Date:** [Date]

## Cardholder Information
Name on card: [Name]
Billing address: [Address]
Card type: [Visa/Mastercard/Amex/etc.]
Card number: [Last 4 digits only — never collect/store full card numbers in a plain document]
Expiration: [MM/YY]

## Charge Authorization
I authorize [Business Name] to charge my card:

- [ ] One-time charge of [Amount] for [Description]
- [ ] Recurring charge of [Amount] on [Frequency] for [Description], starting [Date]

I understand this authorization remains valid until I cancel it in writing.

Cardholder signature: ______________________  Date: ____________

*Never actually write a full card number, CVV, or expiration on a paper or emailed form — collect card details only through a PCI-compliant payment processor. This form is for the authorization/consent record, not for capturing the card itself.*`,
  },
  {
    slug: "photo-release-form-template",
    name: "Photo Release Form",
    seoTitle: "Free Photo Release Form Template",
    description: "Free photo release form template granting permission to use someone's photo or likeness.",
    category: "Legal",
    bodyMarkdown: `# Photo/Video Release Form

**Subject Name:** [Name] (or parent/guardian if a minor)
**Photographer/Organization:** [Name]
**Date:** [Date]

I grant [Photographer/Organization Name] permission to use photographs and/or video of me taken on [Date(s)/Event] for the following purposes: [e.g. "marketing materials, website, and social media"].

## Scope
- [ ] Unlimited use, no time limit
- [ ] Limited to: [Specific use/time period]

## No Compensation
[Choose one: "I understand I will not receive payment for this use." OR describe any agreed compensation.]

## Credit
[Choose one: "No credit is required." OR "I should be credited as: [Name/handle]."]

Subject (or parent/guardian) signature: ______________________  Date: ____________
[If minor] Parent/Guardian name: [Name]

*If the subject is a minor, a parent or legal guardian must sign. Some states have specific rules for commercial use of a minor's likeness — check before using photos of children in paid advertising.*`,
  },
  {
    slug: "sales-compensation-plan-template",
    name: "Sales Compensation Plan",
    seoTitle: "Free Sales Compensation Plan Template",
    description: "Free sales compensation plan template — base pay, commission structure, and quota for a sales role.",
    category: "HR",
    bodyMarkdown: `# Sales Compensation Plan

**Role:** [Job Title]
**Effective Date:** [Date]
**Plan Period:** [e.g. Annual, reviewed quarterly]

## Base Compensation
Base salary: [Amount] per [year/month]

## Commission Structure
| Tier | Threshold | Commission Rate |
|------|-----------|-------------------|
| Tier 1 | Up to [Quota Amount] | [%] |
| Tier 2 | [Quota Amount] – [Amount] | [%] |
| Tier 3 | Above [Amount] | [%] |

## Quota
Annual/quarterly quota: [Amount]
Quota is set by: [Manager/Sales Leadership] and reviewed [Frequency].

## Payout Timing
Commissions are calculated and paid [Frequency, e.g. monthly] based on [closed deals/collected revenue].

## Clawback / Adjustments
[Describe what happens if a deal is cancelled or refunded after commission is paid.]

## Plan Changes
The Company reserves the right to modify this plan with [Notice Period] notice before a new plan period begins.

---
Employee acknowledgment: ______________________  Date: ____________

*A comp plan people can actually calculate themselves builds more trust than a complex one that requires finance to explain each payout — simpler tiers usually outperform "clever" ones.*`,
  },
  {
    slug: "lock-up-agreement-template",
    name: "Lock-Up Agreement",
    seoTitle: "Free Lock-Up Agreement Template",
    description: "Free lock-up agreement template restricting a shareholder from selling shares for a set period (e.g. after a funding round or IPO).",
    category: "Business",
    bodyMarkdown: `# Lock-Up Agreement

**Company:** [Company Name]
**Shareholder:** [Name]
**Date:** [Date]

## 1. Lock-Up Period
Shareholder agrees not to sell, transfer, or otherwise dispose of any shares of the Company's stock held as of the date above for a period of [Duration] following [Triggering Event — e.g. "the closing of the Company's Series A financing"].

## 2. Exceptions
This restriction does not apply to: [e.g. transfers to family members or trusts for estate planning, transfers approved in advance by the Board].

## 3. Legend
Shareholder agrees the Company may place a legend on stock certificates (or book-entry equivalent) referencing this restriction.

## 4. Binding Effect
This Agreement is binding on Shareholder's heirs, executors, and permitted transferees.

## 5. Governing Law
This Agreement is governed by the laws of [State/Country].

---
Company: ______________________  Date: ____________
Shareholder: ______________________  Date: ____________

*This document is provided for informational and educational purposes only and does not constitute legal advice. Lock-up terms are typically part of a larger financing or IPO document set — have a licensed securities attorney review before using.*`,
  },
  {
    slug: "privacy-policy-template",
    name: "Privacy Policy",
    seoTitle: "Free Privacy Policy Template",
    description: "Free privacy policy template for a small business website — what data you collect and how you use it.",
    category: "Legal",
    bodyMarkdown: `# Privacy Policy

**Effective Date:** [Date]

[Company Name] ("we," "us") respects your privacy. This policy explains what information we collect on [Website URL] and how we use it.

## Information We Collect
- **Information you provide:** [e.g. name, email, when you fill out a form or create an account]
- **Automatically collected:** [e.g. IP address, browser type, pages visited — via cookies/analytics]

## How We Use Information
[e.g. to provide our service, respond to inquiries, send updates you've opted into, improve our website.]

## Sharing of Information
We do not sell your personal information. We may share it with: [service providers who help us operate, e.g. hosting/email/payment processors — name categories, not necessarily each vendor].

## Cookies
[Describe cookie use, and link to a cookie preference tool if you have one.]

## Your Rights
Depending on your location, you may have the right to access, correct, or delete your personal information. Contact us at [Email] to make a request.

## Data Retention
[How long you keep personal data, generally.]

## Changes to This Policy
We may update this policy from time to time; the effective date above reflects the most recent version.

## Contact
Questions about this policy: [Email]

*This is a general starting point, not a compliance guarantee. If you collect data from EU residents (GDPR), California residents (CCPA/CPRA), or handle health/financial/children's data, you likely have additional legal obligations — have a licensed attorney review your actual data practices.*`,
  },
  {
    slug: "project-charter-template",
    name: "Project Charter",
    seoTitle: "Free Project Charter Template",
    description: "Free project charter template formally authorizing a project and defining its objectives and scope.",
    category: "Business",
    bodyMarkdown: `# Project Charter: [Project Name]

**Sponsor:** [Name] · **Project Manager:** [Name]
**Date:** [Date]

## Purpose
[Why this project exists — the business need or opportunity driving it.]

## Objectives
[Specific, measurable goals this project must achieve.]

## Scope
**In scope:** [What's included]
**Out of scope:** [What's explicitly excluded]

## Stakeholders
| Name | Role | Interest |
|------|------|----------|
| [Name] | [Role] | [What they care about] |

## Timeline
Start: [Date] · Target completion: [Date]

## Budget
[Approved budget, if applicable]

## Risks
[Key risks identified at the outset]

## Authorization
This charter authorizes the Project Manager to proceed with the resources and scope described above.

Sponsor signature: ______________________  Date: ____________

*A charter's job is to get everyone aligned on scope BEFORE work starts — most scope disputes later trace back to this document being too vague or skipped entirely.*`,
  },
  {
    slug: "software-license-agreement-template",
    name: "Software License Agreement",
    seoTitle: "Free Software License Agreement Template",
    description: "Free software license agreement template for licensing your software to a customer or partner.",
    category: "Legal",
    bodyMarkdown: `# Software License Agreement

**Licensor:** [Company Name]
**Licensee:** [Customer Name]
**Effective Date:** [Date]

## 1. Grant of License
Licensor grants Licensee a [non-exclusive, non-transferable] license to use [Software Name] (the "Software") for [Purpose/Number of users/Internal business use only].

## 2. Restrictions
Licensee may not: reverse-engineer, decompile, sublicense, or resell the Software except as expressly permitted here.

## 3. Fees
Licensee will pay [License fee — one-time or subscription], due [Payment Terms].

## 4. Support and Updates
[Describe what's included — e.g. "Licensor will provide updates and email support during the license term."]

## 5. Warranty Disclaimer
THE SOFTWARE IS PROVIDED "AS IS," WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.

## 6. Limitation of Liability
Licensor's total liability under this Agreement is limited to the fees paid by Licensee in the [12 months] preceding the claim.

## 7. Term and Termination
This license runs for [Term] and may be terminated by either party for material breach not cured within [Cure Period].

## 8. Governing Law
This Agreement is governed by the laws of [State/Country].

---
Licensor: ______________________  Date: ____________
Licensee: ______________________  Date: ____________

*This document is provided for informational and educational purposes only and does not constitute legal advice. Liability caps and warranty disclaimers are the sections most likely to be negotiated or challenged — have a licensed attorney review before using this for a real commercial deal.*`,
  },
  {
    slug: "hold-harmless-agreement-template",
    name: "Hold Harmless Agreement (Release of Liability)",
    seoTitle: "Free Hold Harmless Agreement Template",
    description: "Free hold harmless agreement template — one party agrees not to hold the other liable for injury or loss from a specific activity.",
    category: "Legal",
    bodyMarkdown: `# Hold Harmless Agreement (Release of Liability)

**Releasing Party:** [Name]
**Released Party:** [Name/Organization]
**Activity:** [Description — e.g. "use of the climbing wall at [Facility]"]
**Date:** [Date]

In consideration of being permitted to participate in [Activity], I, [Releasing Party Name], agree as follows:

## 1. Assumption of Risk
I understand that [Activity] involves inherent risks, including [briefly describe — e.g. "physical injury"], and I voluntarily assume these risks.

## 2. Release
I release [Released Party] from any claims, liability, or damages arising from my participation in [Activity], except for claims arising from [Released Party]'s gross negligence or willful misconduct.

## 3. Indemnification
I agree to indemnify [Released Party] for any claims brought by third parties arising from my own actions during [Activity].

## 4. Medical Treatment
[Optional: "I authorize [Released Party] to seek emergency medical treatment on my behalf if needed."]

## 5. Governing Law
This Agreement is governed by the laws of [State/Country].

Signature: ______________________  Date: ____________
[If minor] Parent/Guardian: ______________________

*This document is provided for informational and educational purposes only and does not constitute legal advice. Liability waivers are NOT enforceable in every state for every type of risk (some states limit or ban waivers for gross negligence, or for minors) — confirm enforceability in your state before relying on one.*`,
  },
  {
    slug: "performance-improvement-plan-template",
    name: "Performance Improvement Plan (PIP)",
    seoTitle: "Free Performance Improvement Plan (PIP) Template",
    description: "Free performance improvement plan template documenting specific performance gaps, expectations, and a review timeline.",
    category: "HR",
    bodyMarkdown: `# Performance Improvement Plan

**Employee:** [Name] · **Role:** [Title]
**Manager:** [Name]
**Plan Start Date:** [Date] · **Review Date:** [Date, typically 30-90 days out]

## Performance Concerns
[Specific, factual description of the performance gap(s) — cite dates/examples, not generalizations like "bad attitude."]

## Expectations Going Forward
| Area | Current State | Expected State | Target Date |
|------|----------------|-----------------|--------------|
| [Area 1] | [Description] | [Description] | [Date] |
| [Area 2] | [Description] | [Description] | [Date] |

## Support Provided
[What the manager/company will do to help — training, check-ins, resources.]

## Check-in Schedule
[Frequency of progress reviews during the plan — e.g. weekly 1:1s.]

## Consequences
If performance does not improve to the expected level by the review date, further action may be taken, up to and including termination of employment.

---
Manager signature: ______________________  Date: ____________
Employee signature: ______________________  Date: ____________
*(Signature acknowledges receipt, not necessarily agreement with the assessment.)*

*This document is provided for informational and educational purposes only and does not constitute legal advice. A PIP that's vague or inconsistently applied can itself become evidence in a wrongful-termination claim — be specific, be consistent across employees, and involve HR or legal counsel for anything contentious.*`,
  },
  {
    slug: "letter-of-authorization-template",
    name: "Letter of Authorization",
    seoTitle: "Free Letter of Authorization Template",
    description: "Free letter of authorization template — grants someone else permission to act on your behalf for a specific, limited purpose.",
    category: "Legal",
    bodyMarkdown: `# Letter of Authorization

[Your Name]
[Date]

**RE: Authorization for [Authorized Person Name]**

To Whom It May Concern,

I, [Your Name], authorize [Authorized Person Name] to [specific action — e.g. "pick up documents on my behalf," "discuss my account," "sign for a delivery"] with [Organization Name] on my behalf.

## Scope
This authorization is limited to: [Specific matter — be as narrow as the situation allows].

## Duration
This authorization is valid from [Start Date] to [End Date], or until revoked in writing.

## Verification
[Authorized Person Name]'s ID: [Type of ID they'll present]

Signature: ______________________  Date: ____________
[Your Name]

*Unlike a power of attorney, this is meant for a single, narrow, low-stakes task — for anything involving finances or legal decisions on an ongoing basis, use a Power of Attorney instead.*`,
  },
  {
    slug: "rent-receipt-template",
    name: "Rent Receipt",
    seoTitle: "Free Rent Receipt Template",
    description: "Free rent receipt template for landlords to give tenants proof of payment.",
    category: "Real Estate",
    bodyMarkdown: `# Rent Receipt

**Receipt #:** [Number]
**Date:** [Date]

**Received from:** [Tenant Name]
**Property address:** [Address]
**Amount received:** [Amount]
**Payment period:** [e.g. "Rent for [Month/Year]"]
**Payment method:** [Cash/Check/Bank transfer — include check # if applicable]

**Balance due (if partial payment):** [Amount, or "None — paid in full"]

---
Received by: ______________________
[Landlord/Property Manager Name]

*Some jurisdictions require landlords to provide a receipt for cash payments, or on tenant request — check your local landlord-tenant law. Keeping copies protects both sides in a payment dispute.*`,
  },
  {
    slug: "booking-form-template",
    name: "Booking Form",
    seoTitle: "Free Booking Form Template",
    description: "Free booking form template for reserving a venue, service, or appointment.",
    category: "Business",
    bodyMarkdown: `# Booking Form

**Booking for:** [Service/Venue/Event Name]
**Date submitted:** [Date]

## Client Information
Name: [Name]
Email: [Email] · Phone: [Phone]

## Booking Details
Date(s) requested: [Date(s)]
Time: [Start] – [End]
Number of guests/participants: [Number]
Special requests: [Notes]

## Pricing
| Item | Cost |
|------|------|
| [Base rate] | [Amount] |
| [Add-ons] | [Amount] |
| **Total** | **[Amount]** |

## Deposit & Payment
Deposit required: [Amount], due by [Date]
Balance due: [Amount], due by [Date]

## Cancellation Policy
[Your specific policy — e.g. "Full refund if cancelled 7+ days before the date; 50% refund within 7 days; no refund within 48 hours."]

Client signature: ______________________  Date: ____________

*Stating your cancellation policy clearly on the booking form itself (not just in fine print elsewhere) heads off most disputes before they start.*`,
  },
  {
    slug: "market-research-report-template",
    name: "Market Research Report",
    seoTitle: "Free Market Research Report Template",
    description: "Free market research report template for summarizing findings on a target market, competitor, or customer segment.",
    category: "Business",
    bodyMarkdown: `# Market Research Report: [Topic]

**Prepared by:** [Name] · **Date:** [Date]

## Objective
[What question this research was meant to answer.]

## Methodology
[How the data was gathered — surveys, interviews, secondary research, sample size.]

## Market Overview
[Size, growth rate, and key trends in the market.]

## Target Customer
[Who they are, their needs, and their buying behavior — with data, not assumptions.]

## Competitive Landscape
| Competitor | Strengths | Weaknesses | Pricing |
|------------|-----------|------------|---------|
| [Competitor] | [Strengths] | [Weaknesses] | [Pricing] |

## Key Findings
[The 3-5 most important, specific takeaways — not a restatement of the data.]

## Recommendations
[What to actually do based on the findings above.]

*A research report that ends without clear recommendations tends to get read once and filed away — always connect the data back to a decision.*`,
  },
  {
    slug: "escrow-agreement-template",
    name: "Escrow Agreement",
    seoTitle: "Free Escrow Agreement Template",
    description: "Free escrow agreement template — a neutral third party holds funds or documents until agreed conditions are met.",
    category: "Business",
    bodyMarkdown: `# Escrow Agreement

**Depositor:** [Name]
**Beneficiary:** [Name]
**Escrow Agent:** [Neutral third party name]
**Date:** [Date]

## 1. Deposit
Depositor will deposit [Amount/Description of items] with the Escrow Agent by [Date].

## 2. Conditions for Release
The Escrow Agent will release the deposited [funds/items] to Beneficiary upon: [Describe the specific triggering condition — e.g. "written confirmation from both parties that the goods have been delivered and accepted"].

## 3. Return to Depositor
If the condition above is not met by [Date], the Escrow Agent will return the deposit to Depositor.

## 4. Escrow Agent's Role
The Escrow Agent acts only as a neutral holder and is not liable for any dispute between Depositor and Beneficiary, except for its own negligence or misconduct in handling the deposit.

## 5. Fees
Escrow Agent's fee of [Amount] is paid by [Depositor/Beneficiary/split].

## 6. Governing Law
This Agreement is governed by the laws of [State/Country].

---
Depositor: ______________________  Date: ____________
Beneficiary: ______________________  Date: ____________
Escrow Agent: ______________________  Date: ____________

*This document is provided for informational and educational purposes only and does not constitute legal advice. For real estate or large-dollar transactions, use a licensed escrow company or title company rather than an informal arrangement.*`,
  },
  {
    slug: "payment-plan-agreement-template",
    name: "Payment Plan Agreement",
    seoTitle: "Free Payment Plan Agreement Template",
    description: "Free payment plan agreement template — a signed document (not just an email) documenting an installment arrangement for an unpaid balance.",
    category: "Finance",
    bodyMarkdown: `# Payment Plan Agreement

**Creditor:** [Your Business Name]
**Debtor:** [Client/Customer Name]
**Date:** [Date]
**Original Balance:** [Amount] (Invoice # [Number], dated [Date])

## 1. Payment Schedule
Debtor agrees to pay the outstanding balance of [Amount] according to the following schedule:

| Payment # | Due Date | Amount |
|-----------|----------|--------|
| 1 | [Date] | [Amount] |
| 2 | [Date] | [Amount] |
| 3 | [Date] | [Amount] |

## 2. Payment Method
Payments will be made via [Method — e.g. bank transfer, card on file].

## 3. Missed Payments
If a payment is more than [Number] days late, [Creditor] may [charge a late fee of [Amount/%] / declare the full remaining balance due immediately / other consequence].

## 4. No Further Charges
Provided all payments are made on schedule, no additional interest or fees will be added to the original balance.

## 5. Acknowledgment
Debtor acknowledges this balance is valid and owed.

---
Creditor: ______________________  Date: ____________
Debtor: ______________________  Date: ____________

*Getting this signed (not just agreed over email) makes it far easier to enforce if a payment is missed — and having specific dates and amounts removes any "I thought it was different" ambiguity later.*`,
  },
  {
    slug: "proforma-invoice-template",
    name: "Proforma Invoice",
    seoTitle: "Free Proforma Invoice Template",
    description: "Free proforma invoice template — a preliminary bill of sale sent before goods/services are delivered, common in international trade.",
    category: "Finance",
    bodyMarkdown: `# Proforma Invoice

**Proforma Invoice #:** [Number] · **Date:** [Date]
**Valid until:** [Date — proforma invoices are typically only valid for a limited time]

**Seller:** [Name, Address]
**Buyer:** [Name, Address]

## Goods/Services

| Description | Qty | Unit Price | Total |
|-------------|-----|-------------|-------|
| [Description] | [Qty] | [Price] | [Total] |

**Subtotal:** [Amount]
**Shipping/Handling:** [Amount]
**Estimated Total: [Amount]**

## Terms
Payment terms: [e.g. "50% deposit to confirm order, balance before shipment"]
Estimated delivery: [Timeframe]
Incoterms (if international): [e.g. FOB, CIF]

**This is NOT a demand for payment and does not constitute a final invoice or tax document — actual amounts may change based on final order details.**

*A proforma invoice is used to confirm order details and pricing before commitment (and often for customs/import estimates) — issue a final commercial invoice once the goods actually ship.*`,
  },
  {
    slug: "general-demand-letter-template",
    name: "General Demand Letter",
    seoTitle: "Free General Demand Letter Template",
    description: "Free general demand letter template for demanding payment, action, or resolution before pursuing further action.",
    category: "Legal",
    bodyMarkdown: `# Demand Letter

[Your Name/Company]
[Your Address]
[Date]

[Recipient Name]
[Recipient Address]

**RE: Demand for [Payment / Specific Performance / Resolution] — [Brief Subject]**

Dear [Recipient Name],

This letter serves as formal demand that you [specific demand — e.g. "pay the outstanding amount of $X" or "cease the conduct described below"].

## Background
[Factual, dated summary of what happened — the agreement, what was owed or promised, and what has (or hasn't) occurred since.]

## Demand
I demand that you [specific action] within [Number] days of the date of this letter, i.e. by [Date].

## Consequences of Non-Compliance
If this matter is not resolved by the date above, I will pursue all available remedies, which may include [small claims court / formal collections / legal action], without further notice.

I am hopeful this can be resolved directly and would welcome your response.

Sincerely,
[Your Name]

*A demand letter is most effective when it's specific (exact amount, exact date), factual (no exaggeration), and professional in tone — that combination is what makes it look credible if it's ever produced as evidence later.*`,
  },
  {
    slug: "property-condition-report-template",
    name: "Property Condition Report",
    seoTitle: "Free Property Condition Report Template",
    description: "Free property condition report (move-in/move-out) template documenting a rental's condition for the security deposit record.",
    category: "Real Estate",
    bodyMarkdown: `# Property Condition Report

**Property Address:** [Address]
**Inspection Type:** [ ] Move-in  [ ] Move-out
**Date:** [Date]
**Tenant(s):** [Name(s)]

## Room-by-Room Condition

| Room | Condition | Notes / Existing Damage |
|------|-----------|---------------------------|
| Living Room | [Good/Fair/Poor] | [Notes] |
| Kitchen | [Good/Fair/Poor] | [Notes] |
| Bedroom(s) | [Good/Fair/Poor] | [Notes] |
| Bathroom(s) | [Good/Fair/Poor] | [Notes] |
| Other | [Good/Fair/Poor] | [Notes] |

## Appliances
[List each appliance and its condition — stove, fridge, washer/dryer, etc.]

## Keys/Access Devices Provided
[Number of keys, fobs, garage remotes, etc.]

## Photos
[Note that photos were taken and attached, with date/timestamp — strongly recommended for both move-in and move-out.]

## Acknowledgment
Both parties agree this report accurately reflects the property's condition as of the date above.

Landlord/Manager: ______________________  Date: ____________
Tenant: ______________________  Date: ____________

*Completing this together at both move-in and move-out — with photos — is the single best protection against security deposit disputes for both sides.*`,
  },
  {
    slug: "conflict-of-interest-policy-template",
    name: "Conflict of Interest Policy",
    seoTitle: "Free Conflict of Interest Policy Template",
    description: "Free conflict of interest policy template for a company or nonprofit board — disclosure and recusal process.",
    category: "Business",
    bodyMarkdown: `# Conflict of Interest Policy

**Organization:** [Company/Organization Name]
**Adopted:** [Date]

## Purpose
This policy ensures that decisions are made in the organization's best interest, free from undisclosed personal or financial conflicts.

## What Counts as a Conflict
A conflict of interest exists when a director, officer, or employee (or their family member) has a financial or personal interest that could influence their judgment on behalf of the organization — for example, a financial stake in a vendor being considered for a contract.

## Disclosure
Anyone covered by this policy must disclose a potential conflict as soon as they become aware of it, in writing, to [the Board Chair / designated compliance contact].

## Recusal
A person with a disclosed conflict must not participate in the discussion or vote on the matter, though they may be asked to provide relevant factual information first.

## Annual Disclosure
Covered individuals will complete an annual conflict-of-interest disclosure statement.

## Violations
Failure to disclose a known conflict may result in [consequences — e.g. removal from the board, disciplinary action].

---
Adopted by: ______________________  Date: ____________

*This is a general template — nonprofit boards in particular should confirm this policy meets their state's requirements and, if seeking 501(c)(3) status, IRS Form 1023 expectations.*`,
  },
  {
    slug: "settlement-agreement-template",
    name: "Settlement Agreement",
    seoTitle: "Free Settlement Agreement Template",
    description: "Free settlement agreement template resolving a dispute between two parties without going to court.",
    category: "Legal",
    bodyMarkdown: `# Settlement Agreement

**Party A:** [Name]
**Party B:** [Name]
**Date:** [Date]

## 1. Background
The parties were in dispute regarding: [Brief, neutral description of the dispute].

## 2. Settlement Terms
To resolve this dispute without further proceedings, the parties agree:
1. [Term — e.g. "Party A will pay Party B $[Amount] within [X] days"]
2. [Term — e.g. "Party B withdraws the claim/complaint referenced above"]
3. [Any other specific terms]

## 3. Release
Upon full performance of the terms above, each party releases the other from any further claims related to this dispute.

## 4. Confidentiality
[Optional: "The parties agree to keep the terms and existence of this settlement confidential, except as required by law."]

## 5. No Admission
This Agreement is not an admission of liability or wrongdoing by either party.

## 6. Governing Law
This Agreement is governed by the laws of [State/Country].

---
Party A: ______________________  Date: ____________
Party B: ______________________  Date: ____________

*This document is provided for informational and educational purposes only and does not constitute legal advice. If the dispute already involves a filed lawsuit or a lawyer on either side, have your own attorney review any settlement before signing.*`,
  },
  {
    slug: "vendor-application-template",
    name: "Vendor Application",
    seoTitle: "Free Vendor Application Template",
    description: "Free vendor application template for onboarding a new supplier or market/event vendor.",
    category: "Business",
    bodyMarkdown: `# Vendor Application

**Business Name:** [Vendor's Business Name]
**Contact Name:** [Name] · **Email:** [Email] · **Phone:** [Phone]

## Business Information
Business type: [Sole prop/LLC/Corp]
Years in business: [Number]
Tax ID / EIN: [Number]
Products/services offered: [Description]

## References
1. [Client/reference name and contact]
2. [Client/reference name and contact]

## Insurance & Compliance
Business insurance carrier: [Name] · Policy #: [Number]
[If applicable: relevant licenses/permits/certifications]

## Terms Requested
Proposed payment terms: [e.g. Net 30]
Proposed pricing: [Attach separately if applicable]

## Acknowledgment
Applicant certifies the above information is accurate.

Signature: ______________________  Date: ____________

*Checking at least one reference and confirming insurance/licensing before approval catches most problem vendors before they become a real issue.*`,
  },
  {
    slug: "basic-franchise-agreement-outline-template",
    name: "Basic Franchise Agreement Outline",
    seoTitle: "Free Franchise Agreement Outline Template",
    description: "Free franchise agreement outline template — the section structure a simple franchise arrangement needs (not a substitute for FDD compliance).",
    category: "Business",
    bodyMarkdown: `# Franchise Agreement Outline

**Franchisor:** [Company Name]
**Franchisee:** [Name]
**Location:** [Territory/Address]
**Date:** [Date]

## 1. Grant of Franchise
Franchisor grants Franchisee the right to operate a [Brand Name] business at/within [Location/Territory] using Franchisor's trademarks, systems, and methods.

## 2. Term
This franchise runs for [Duration], with [renewal terms, if any].

## 3. Fees
- Initial franchise fee: [Amount], due [Timing]
- Ongoing royalty: [%] of gross revenue, paid [Frequency]
- Marketing fund contribution: [%], if applicable

## 4. Franchisor's Obligations
[Training, initial support, ongoing support, use of the system's marketing materials.]

## 5. Franchisee's Obligations
[Operate per the brand's standards, maintain quality/branding, report sales, pay fees on time.]

## 6. Territory
[Exclusive or non-exclusive rights within the defined territory.]

## 7. Termination
[Grounds for termination by either party, and post-termination obligations — e.g. de-identification of the location.]

## 8. Governing Law
This Agreement is governed by the laws of [State/Country].

---
Franchisor: ______________________  Date: ____________
Franchisee: ______________________  Date: ____________

*Franchising is one of the most heavily regulated areas of US business law — in most states, a Franchise Disclosure Document (FDD) must be provided to prospective franchisees before signing anything, well before this outline would apply. This template is a structural starting point only; use a licensed franchise attorney for an actual franchise program.*`,
  },
  {
    slug: "fee-schedule-template",
    name: "Fee Schedule",
    seoTitle: "Free Fee Schedule Template",
    description: "Free fee schedule template for clearly listing your service prices for clients.",
    category: "Business",
    bodyMarkdown: `# Fee Schedule — [Business Name]

**Effective:** [Date]

| Service | Description | Fee |
|---------|-------------|-----|
| [Service 1] | [Brief description] | [Amount] |
| [Service 2] | [Brief description] | [Amount] |
| [Service 3] | [Brief description] | [Amount] |

## Additional Fees
- [e.g. "Rush service: +X%"]
- [e.g. "Travel outside a X-mile radius: $Y"]

## Payment Terms
[e.g. "50% deposit required to book, balance due on completion. Prices subject to change with 30 days' notice to existing clients."]

*Publishing a clear fee schedule up front reduces the "how much will this cost" back-and-forth and sets expectations before a client ever asks.*`,
  },
  {
    slug: "thank-you-letter-template",
    name: "Thank You Letter",
    seoTitle: "Free Thank You Letter Template",
    description: "Free thank you letter template for a client, interviewer, or business contact.",
    category: "Business",
    bodyMarkdown: `# Thank You Letter

[Your Name]
[Date]

Dear [Recipient Name],

Thank you for [specific reason — meeting with me, the opportunity, your business, your time]. I wanted to follow up and [express appreciation / reiterate interest / recap a key point].

[One or two specific sentences referencing something from the actual interaction — shows this isn't a form letter.]

[Optional: a next step — "I look forward to [next step]" or "Please don't hesitate to reach out if [anything]."]

Thank you again,
[Your Name]

*A thank-you note that references something specific from the actual conversation is remembered; a generic one is forgotten just as fast as it was sent.*`,
  },
  {
    slug: "management-agreement-template",
    name: "Management Agreement",
    seoTitle: "Free Management Agreement Template",
    description: "Free management agreement template — for hiring a manager to run a property, business, or specific operation on your behalf.",
    category: "Business",
    bodyMarkdown: `# Management Agreement

**Owner:** [Name]
**Manager:** [Name]
**Property/Business:** [Description]
**Effective Date:** [Date]

## 1. Appointment
Owner appoints Manager to manage [Property/Business] and Manager accepts this appointment.

## 2. Manager's Duties
[Describe specifically — e.g. day-to-day operations, tenant relations, staffing, bookkeeping, maintenance coordination.]

## 3. Manager's Authority
Manager may [act on Owner's behalf up to $[Amount] without prior approval / requires approval for expenses over $[Amount]].

## 4. Compensation
Owner will pay Manager [Flat fee / % of revenue/rent collected], paid [Frequency].

## 5. Reporting
Manager will provide Owner with [financial reports/updates] on a [Monthly/Quarterly] basis.

## 6. Term and Termination
This Agreement runs for [Term] and may be terminated by either party with [Notice Period] written notice.

## 7. Governing Law
This Agreement is governed by the laws of [State/Country].

---
Owner: ______________________  Date: ____________
Manager: ______________________  Date: ____________

*This document is provided for informational and educational purposes only and does not constitute legal advice. Property management specifically may require the Manager to hold a real estate or property management license depending on your state — confirm before signing.*`,
  },
  {
    slug: "consignment-agreement-template",
    name: "Consignment Agreement",
    seoTitle: "Free Consignment Agreement Template",
    description: "Free consignment agreement template — a consignor places goods with a consignee to sell on their behalf for a share of the proceeds.",
    category: "Business",
    bodyMarkdown: `# Consignment Agreement

**Consignor:** [Name] (owns the goods)
**Consignee:** [Name] (will sell the goods)
**Date:** [Date]

## 1. Goods Consigned
Consignor delivers the following goods to Consignee for sale: [Description, quantity, and agreed value of each item].

## 2. Consignee's Authority
Consignee may sell the goods at a price of [Fixed price / Consignor's suggested price ± X%] and is authorized to negotiate within that range.

## 3. Proceeds Split
Upon sale, proceeds are split: Consignor receives [%], Consignee receives [%] as a commission.

## 4. Payment
Consignee will pay Consignor their share within [Number] days of each sale, along with an accounting of what sold.

## 5. Unsold Goods
Goods unsold after [Duration] will be [returned to Consignor / Consignor notified for pickup], at Consignor's expense unless agreed otherwise.

## 6. Risk of Loss
[Specify who bears the risk if goods are lost, stolen, or damaged while in Consignee's possession — commonly the Consignee, but state it explicitly.]

## 7. Ownership
Consignor retains ownership of the goods until they are sold to an end buyer.

---
Consignor: ______________________  Date: ____________
Consignee: ______________________  Date: ____________

*Being explicit about who bears the risk of loss/damage before a sale is the single most common source of consignment disputes — don't leave it unstated.*`,
  },
  {
    slug: "vision-statement-template",
    name: "Vision Statement",
    seoTitle: "Free Vision Statement Template",
    description: "Free vision statement template — a short, forward-looking statement of what your company is working toward.",
    category: "Business",
    bodyMarkdown: `# Vision Statement: [Company Name]

## Draft your vision statement by answering:

**What future are we working toward?**
[The world/industry/outcome you're ultimately aiming for — bigger than any single product.]

**Why does this matter?**
[The change this future represents, and why it's worth pursuing.]

## Example structure
"[Company Name] envisions a world where [future state] — where [specific, tangible change from today]."

## Draft
[Write your one or two sentence vision statement here.]

*A vision statement describes the future you're working toward (long-term, aspirational); a mission statement describes what you do today to get there. Keep them distinct rather than merging them into one vague sentence.*`,
  },
  {
    slug: "business-continuity-plan-template",
    name: "Business Continuity Plan",
    seoTitle: "Free Business Continuity Plan Template",
    description: "Free business continuity plan template — how your business keeps operating through a disruption (outage, disaster, key-person loss).",
    category: "Business",
    bodyMarkdown: `# Business Continuity Plan — [Company Name]

**Last updated:** [Date] · **Owner:** [Name]

## Purpose
This plan describes how [Company Name] continues operating (or recovers quickly) through a significant disruption.

## Key Risks Identified
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| [e.g. Key supplier failure] | [Low/Med/High] | [Low/Med/High] | [Mitigation] |
| [e.g. Office/site unavailable] | [Low/Med/High] | [Low/Med/High] | [Mitigation] |
| [e.g. Key person unavailable] | [Low/Med/High] | [Low/Med/High] | [Mitigation] |

## Critical Functions
[List the 3-5 things that absolutely must keep running — e.g. "process customer payments," "respond to support tickets."]

## Recovery Steps
For each critical function above, describe: who's responsible, what resources/backups exist, and the target recovery time.

## Communication Plan
Who notifies whom, and how, when a disruption occurs — employees, customers, vendors.

## Key Contacts
| Role | Name | Contact |
|------|------|---------|
| [Role] | [Name] | [Phone/Email] |

## Testing
This plan should be reviewed and tested at least [annually].

*A plan that only lives in a document, never tested, tends to fail exactly when needed — even a quick tabletop walkthrough once a year catches gaps a document review won't.*`,
  },
  {
    slug: "communication-plan-template",
    name: "Communication Plan",
    seoTitle: "Free Communication Plan Template",
    description: "Free communication plan template for a project or organizational change — who needs to know what, and when.",
    category: "Business",
    bodyMarkdown: `# Communication Plan: [Project/Initiative Name]

**Owner:** [Name] · **Date:** [Date]

## Objective
[What this communication plan needs to achieve — awareness, buy-in, action.]

## Audiences

| Audience | What they need to know | Channel | Frequency | Owner |
|----------|--------------------------|---------|-----------|-------|
| [e.g. Employees] | [Key message] | [Email/meeting/Slack] | [Frequency] | [Name] |
| [e.g. Customers] | [Key message] | [Email/website] | [Frequency] | [Name] |
| [e.g. Leadership] | [Key message] | [Meeting/report] | [Frequency] | [Name] |

## Key Messages
[The 2-3 core messages that should stay consistent across every audience, worded once here so nobody improvises differently.]

## Timeline
| Date | Milestone | Communication |
|------|-----------|-----------------|
| [Date] | [Milestone] | [What goes out] |

## Feedback Loop
[How you'll collect and respond to questions/concerns as they come in.]

*Writing the key messages once, in this document, and having everyone communicating pull from them is what keeps a rollout from turning into five slightly different versions of the same story.*`,
  },
  {
    slug: "company-letterhead-template",
    name: "Company Letterhead Template",
    seoTitle: "Free Company Letterhead Template",
    description: "Free company letterhead template — the header/footer structure for professional business correspondence.",
    category: "Business",
    bodyMarkdown: `# [Your Company Name]
[Street Address, City, State ZIP]
[Phone] · [Email] · [Website]

---

[Date]

[Recipient Name]
[Recipient Address]

Dear [Recipient Name],

[Body of your letter goes here.]

Sincerely,

[Your Name]
[Your Title]
[Your Company Name]

---
[Company Name] · [Website] · [Phone]

*Keep the header simple enough to work in plain text email as well as print — logo and color styling can be layered on top in a word processor or design tool once the content structure above is set.*`,
  },
  {
    slug: "multi-member-llc-operating-agreement-template",
    name: "Multi-Member LLC Operating Agreement",
    seoTitle: "Free Multi-Member LLC Operating Agreement Template",
    description: "Free multi-member LLC operating agreement template — ownership splits, management, and voting for an LLC with more than one owner.",
    category: "Business",
    bodyMarkdown: `# Multi-Member LLC Operating Agreement

**Company:** [Company Name], a [State] limited liability company
**Members:** [List all members]
**Effective Date:** [Date]

## 1. Formation
The Company was formed under [State] law by filing Articles of Organization on [Date].

## 2. Ownership

| Member | Ownership % | Initial Contribution |
|--------|-------------|------------------------|
| [Member 1] | [%] | [Amount/Description] |
| [Member 2] | [%] | [Amount/Description] |

## 3. Management
[Choose one: "Member-managed — all Members participate in day-to-day decisions." OR "Manager-managed — [Name] is designated Manager with authority to bind the Company."]

## 4. Voting
Major decisions ([list — e.g. "taking on debt over $X, admitting new members, dissolving the Company"]) require approval of Members holding at least [%] of ownership. Routine decisions may be made by [Manager / majority vote].

## 5. Distributions
Distributions are made to Members in proportion to ownership percentage, at times determined by [Manager/Member vote].

## 6. Transfer of Membership Interest
A Member may not transfer their interest without [unanimous consent of other Members / right of first refusal for remaining Members].

## 7. Withdrawal or Death of a Member
[Describe buyout terms, valuation method, and timeline for the remaining Members to purchase the departing/deceased Member's interest.]

## 8. Dissolution
The Company may be dissolved by [vote of Members holding X% ownership], or as otherwise required by law.

## 9. Amendments
This Agreement may be amended only by written agreement of Members holding at least [%] of ownership.

---
[Repeat for each Member:]
Member: ______________________  Date: ____________

*This document is provided for informational and educational purposes only and does not constitute legal advice. Multi-member LLCs have more room for future disputes than single-member ones — voting thresholds, buyout terms, and deadlock provisions deserve real attention from a licensed attorney before you need them.*`,
  },
  {
    slug: "credit-application-template",
    name: "Credit Application",
    seoTitle: "Free Credit Application Template",
    description: "Free credit application template for a business extending trade credit (e.g. Net 30 terms) to a new customer.",
    category: "Finance",
    bodyMarkdown: `# Credit Application

**Applicant Business Name:** [Name]
**Business Address:** [Address]
**Tax ID / EIN:** [Number]
**Years in business:** [Number]

## Requested Terms
Credit limit requested: [Amount]
Payment terms requested: [e.g. Net 30]

## Business References (Trade)
1. [Company name, contact, phone] — Account since [Date]
2. [Company name, contact, phone] — Account since [Date]

## Bank Reference
Bank name: [Name] · Account contact: [Name/Phone]

## Authorized Signers
[Name(s) authorized to make purchases on this account]

## Authorization
Applicant authorizes [Your Company Name] to verify the above references and check business/personal credit as applicable.

Signature: ______________________  Date: ____________
[Name, Title]

*Checking at least the trade references before extending significant credit catches most bad-payer risk before it becomes your problem — docstoc's follow-up templates cover what to do if it doesn't.*`,
  },
  {
    slug: "personal-financial-statement-template",
    name: "Personal Financial Statement",
    seoTitle: "Free Personal Financial Statement Template",
    description: "Free personal financial statement template — assets, liabilities, and net worth, often required for a loan application.",
    category: "Finance",
    bodyMarkdown: `# Personal Financial Statement

**Name:** [Name] · **Date:** [Date]

## Assets
| Item | Value |
|------|-------|
| Cash / bank accounts | [Amount] |
| Investments (stocks, retirement accounts) | [Amount] |
| Real estate (market value) | [Amount] |
| Vehicles | [Amount] |
| Business interests | [Amount] |
| Other assets | [Amount] |
| **Total Assets** | **[Amount]** |

## Liabilities
| Item | Value |
|------|-------|
| Mortgage(s) | [Amount] |
| Auto loans | [Amount] |
| Credit card debt | [Amount] |
| Student loans | [Amount] |
| Other debts | [Amount] |
| **Total Liabilities** | **[Amount]** |

## Net Worth
**Total Assets − Total Liabilities = [Amount]**

## Income Sources
[Salary, business income, investment income — annual amounts]

---
I certify the above is accurate to the best of my knowledge.

Signature: ______________________  Date: ____________

*Lenders typically want this dated within the last 30-90 days and may ask for supporting documentation (statements, appraisals) — don't round numbers aggressively, as discrepancies can delay or sink an application.*`,
  },
  {
    slug: "simple-last-will-and-testament-template",
    name: "Simple Last Will and Testament",
    seoTitle: "Free Simple Last Will and Testament Template",
    description: "Free simple last will and testament template — a basic starting point for straightforward estates. Strongly consider an attorney.",
    category: "Legal",
    bodyMarkdown: `# Last Will and Testament of [Your Full Legal Name]

I, [Your Full Legal Name], residing at [Address], being of sound mind, declare this to be my Last Will and Testament, revoking all prior wills and codicils.

## 1. Executor
I appoint [Executor Name] as Executor of this Will. If they are unable or unwilling to serve, I appoint [Alternate Executor Name] as alternate.

## 2. Guardian (if applicable)
If I have minor children at the time of my death, I appoint [Guardian Name] as their guardian.

## 3. Distribution of Property
I direct my Executor to distribute my property as follows:
- To [Beneficiary Name]: [Specific item or % of estate]
- To [Beneficiary Name]: [Specific item or % of estate]
- Remainder of my estate to: [Beneficiary Name(s)]

## 4. Specific Bequests
[Any specific items you want to go to a specific person — e.g. "my [item] to [Name]."]

## 5. Residuary Clause
Any property not otherwise specifically disposed of above shall go to: [Name(s)/entity].

## 6. Debts and Expenses
I direct my Executor to pay my just debts, funeral expenses, and estate administration costs from my estate before distribution.

---
Signed: ______________________  Date: ____________
[Your Full Legal Name]

**Witnesses** (most states require at least 2 witnesses who are not beneficiaries, signing in your presence):
Witness 1: ______________________  Date: ____________
Witness 2: ______________________  Date: ____________

*This document is provided for informational and educational purposes only and is NOT a substitute for legal advice. Wills have strict, state-specific execution requirements (number of witnesses, notarization/self-proving affidavits, holographic will rules) — an improperly executed will can be thrown out entirely. For anything beyond the simplest estate, or if you have minor children, significant assets, or a blended family, use a licensed estate attorney.*`,
  },
  {
    slug: "method-statement-template",
    name: "Method Statement",
    seoTitle: "Free Method Statement Template",
    description: "Free method statement template describing how a specific work task will be carried out safely, step by step.",
    category: "Business",
    bodyMarkdown: `# Method Statement

**Project:** [Project Name] · **Task:** [Task Description]
**Prepared by:** [Name] · **Date:** [Date]

## 1. Scope of Work
[What this specific task covers.]

## 2. Sequence of Operations
1. [Step 1]
2. [Step 2]
3. [Step 3]

## 3. Resources Required
Personnel: [Roles/number needed]
Equipment: [List]
Materials: [List]

## 4. Hazards and Controls
| Hazard | Control Measure |
|--------|-------------------|
| [Hazard] | [Control] |
| [Hazard] | [Control] |

## 5. Personal Protective Equipment (PPE)
[Required PPE for this task]

## 6. Emergency Procedures
[What to do if something goes wrong during this task]

---
Approved by: ______________________  Date: ____________

*A method statement works alongside a risk assessment, not instead of one — many clients/regulators require both before work starts on site.*`,
  },
  {
    slug: "service-agreement-template",
    name: "Service Agreement",
    seoTitle: "Free Service Agreement Template",
    description: "Free general service agreement template for providing an ongoing or one-time service to a client.",
    category: "Business",
    bodyMarkdown: `# Service Agreement

**Provider:** [Provider Name]
**Client:** [Client Name]
**Effective Date:** [Date]

## 1. Services
Provider will provide the following services: [Description].

## 2. Term
This Agreement runs from [Start Date] to [End Date / "until terminated as described below"].

## 3. Fees and Payment
Client will pay [Amount/Rate], due [Payment Terms].

## 4. Responsibilities
**Provider will:** [List]
**Client will:** [e.g. provide access/information/materials needed]

## 5. Termination
Either party may terminate with [Notice Period] written notice.

## 6. Liability
[Choose one: describe a liability cap, or state that each party is responsible for its own acts.]

## 7. Governing Law
This Agreement is governed by the laws of [State/Country].

---
Provider: ______________________  Date: ____________
Client: ______________________  Date: ____________

*This document is provided for informational and educational purposes only and does not constitute legal advice. For a specific type of service (consulting, software, construction), a more specialized agreement usually serves you better than this general one.*`,
  },
  {
    slug: "collection-letter-template",
    name: "Collection Letter",
    seoTitle: "Free Collection Letter Template",
    description: "Free formal collection letter template — printable business-letter format for a seriously overdue invoice.",
    category: "Finance",
    bodyMarkdown: `# Collection Letter

[Your Company Name]
[Your Address]
[Date]

[Client Name]
[Client Address]

**RE: Overdue Account — Invoice #[Number], $[Amount]**

Dear [Client Name],

Our records show that invoice #[Number], for [Amount], due [Due Date], remains unpaid — now [Number] days overdue.

We have previously reached out on [Date(s) of prior reminders] without a response. This letter is a formal request for payment.

## What we need
Please remit payment of [Amount] within [Number] days of this letter, i.e. by [Date].

## If there's an issue
If you believe this amount is incorrect, or there's a reason for the delay we should know about, please contact us at [Phone/Email] before the date above.

## Next steps if unresolved
If payment is not received or this matter is not addressed by [Date], we will [consider further collection action / refer this to a collections agency / pursue other remedies].

We value our business relationship and would prefer to resolve this directly.

Sincerely,
[Your Name/Title]
[Your Company Name]

*Unlike Chasa's email reminder templates, this printable letter format is meant for a more serious, later-stage stage — a physical or formal-looking letter often gets attention an email didn't.*`,
  },
  {
    slug: "incident-report-template",
    name: "Incident Report",
    seoTitle: "Free Incident Report Template",
    description: "Free incident report template for documenting a workplace injury, accident, or safety incident.",
    category: "HR",
    bodyMarkdown: `# Incident Report

**Date of incident:** [Date] · **Time:** [Time]
**Location:** [Location]
**Reported by:** [Name] · **Date reported:** [Date]

## People Involved
Injured/affected person: [Name, role]
Witnesses: [Name(s)]

## What Happened
[Factual, objective description — what happened, in what order. Avoid speculation about cause or blame here.]

## Injuries / Damage
[Describe any injury or property damage, and first aid/medical treatment given, if any.]

## Immediate Actions Taken
[What was done right after the incident — first aid, area secured, supervisor notified, etc.]

## Root Cause (if known)
[What led to this — equipment failure, procedure not followed, hazard not identified, etc.]

## Corrective Actions
| Action | Owner | Due Date |
|--------|-------|----------|
| [Action] | [Name] | [Date] |

---
Reported by: ______________________  Date: ____________
Reviewed by: ______________________  Date: ____________

*Report incidents as soon as possible while details are fresh, and stick to observable facts — interpretation and blame belong in a separate investigation, not the initial report.*`,
  },
  {
    slug: "subscription-agreement-template",
    name: "Subscription Agreement",
    seoTitle: "Free Subscription Agreement Template",
    description: "Free subscription agreement template for a recurring SaaS, membership, or content subscription.",
    category: "Business",
    bodyMarkdown: `# Subscription Agreement

**Provider:** [Company Name]
**Subscriber:** [Customer Name]
**Effective Date:** [Date]

## 1. Subscription
Subscriber subscribes to [Product/Service Name] at the [Plan Name] tier, which includes: [Description of what's included].

## 2. Fees and Billing
Subscription fee: [Amount] per [Billing Period], billed automatically to the payment method on file, starting [Date].

## 3. Term and Auto-Renewal
This subscription automatically renews each [Billing Period] unless cancelled before the renewal date.

## 4. Cancellation
Subscriber may cancel at any time via [Method — e.g. account settings]. Cancellation takes effect at the end of the current billing period; [no refund for the remainder / prorated refund — specify your policy].

## 5. Changes to the Service
Provider may modify features or pricing with [Notice Period] notice; continued use after a pricing change constitutes acceptance.

## 6. Termination by Provider
Provider may suspend or terminate the subscription for non-payment or violation of [Terms of Service], with notice where practical.

## 7. Governing Law
This Agreement is governed by the laws of [State/Country].

---
Subscriber acceptance: ______________________  Date: ____________

*This document is provided for informational and educational purposes only and does not constitute legal advice. If you're selling to consumers, check your jurisdiction's auto-renewal disclosure rules (several US states require specific cancellation-ease and notice requirements for recurring subscriptions).*`,
  },
  {
    slug: "packing-list-template",
    name: "Packing List",
    seoTitle: "Free Packing List Template",
    description: "Free packing list template for a shipment — itemized contents, weights, and package counts.",
    category: "Business",
    bodyMarkdown: `# Packing List

**Shipment #:** [Number] · **Date:** [Date]
**Shipper:** [Name, Address]
**Consignee:** [Name, Address]
**Related Invoice #:** [Number]

## Package Contents

| Package # | Description | Quantity | Weight | Dimensions |
|-----------|-------------|----------|--------|-------------|
| 1 | [Description] | [Qty] | [Weight] | [Dimensions] |
| 2 | [Description] | [Qty] | [Weight] | [Dimensions] |

**Total packages:** [Number]
**Total weight:** [Amount]

## Shipping Details
Carrier: [Name] · Tracking #: [Number]
Ship date: [Date]

---
Prepared by: ______________________  Date: ____________

*Keep the packing list contents consistent with the commercial invoice — a mismatch between the two is one of the most common causes of customs delays on international shipments.*`,
  },
  {
    slug: "project-status-report-template",
    name: "Project Status Report",
    seoTitle: "Free Project Status Report Template",
    description: "Free project status report template — a quick, recurring update on progress, risks, and next steps.",
    category: "Business",
    bodyMarkdown: `# Project Status Report

**Project:** [Project Name] · **Reporting Period:** [Date] – [Date]
**Prepared by:** [Name]

## Overall Status
[ ] On track  [ ] At risk  [ ] Delayed

## Progress This Period
[What was accomplished — specific, not "made progress."]

## Upcoming
[What's planned for the next period.]

## Risks & Issues
| Risk/Issue | Impact | Mitigation |
|------------|--------|------------|
| [Item] | [Impact] | [Plan] |

## Budget Status
Spent to date: [Amount] of [Total Budget] ([%])

## Schedule Status
On track for: [Target date], vs. original: [Original date]

*A status report that only ever says "on track" stops being useful — flag risks early, even small ones, so nobody's surprised later.*`,
  },
  {
    slug: "sublease-agreement-template",
    name: "Sublease Agreement",
    seoTitle: "Free Sublease Agreement Template",
    description: "Free sublease agreement template for a tenant subletting part or all of their rented space to someone else.",
    category: "Real Estate",
    bodyMarkdown: `# Sublease Agreement

**Sublessor (original tenant):** [Name]
**Sublessee (subtenant):** [Name]
**Property:** [Address, and unit/room if partial]
**Original Lease Date:** [Date] with [Landlord Name]

## 1. Term
This sublease runs from [Start Date] to [End Date], not extending beyond the original lease's end date of [Date].

## 2. Rent
Sublessee will pay Sublessor [Amount] per [month], due on the [Day] of each month.

## 3. Security Deposit
Sublessee will pay a security deposit of [Amount], refundable per the same terms as the original lease.

## 4. Landlord Consent
[State whether the original lease requires landlord approval for subletting, and confirm it was obtained: "Landlord has approved this sublease in writing, attached."]

## 5. Sublessee's Obligations
Sublessee agrees to follow all terms of the original lease (attached/referenced) as they apply to the subleased space.

## 6. Original Tenant's Liability
Sublessor remains responsible to Landlord under the original lease for the full term, regardless of this sublease.

---
Sublessor: ______________________  Date: ____________
Sublessee: ______________________  Date: ____________

*This document is provided for informational and educational purposes only and does not constitute legal advice. Many leases prohibit subletting without landlord consent — confirm your original lease actually allows it before signing this.*`,
  },
  {
    slug: "shareholders-agreement-template",
    name: "Shareholders Agreement",
    seoTitle: "Free Shareholders Agreement Template",
    description: "Free shareholders agreement template covering share transfers, decision-making, and exit terms for a corporation's owners.",
    category: "Business",
    bodyMarkdown: `# Shareholders Agreement

**Company:** [Company Name]
**Shareholders:** [List all shareholders and their ownership %]
**Effective Date:** [Date]

## 1. Purpose
This Agreement supplements the Company's bylaws to govern the relationship between shareholders.

## 2. Board Composition
The board consists of [Number] directors, appointed as follows: [Describe — e.g. "each shareholder holding 20%+ may appoint one director"].

## 3. Major Decisions
The following require approval of shareholders holding at least [%] of shares: [e.g. "issuing new shares, taking on debt over $X, selling the company"].

## 4. Transfer Restrictions
A shareholder may not sell or transfer shares to an outside party without first offering them to existing shareholders (right of first refusal) at the same price and terms.

## 5. Drag-Along / Tag-Along Rights
[Describe if included — e.g. "If shareholders holding 75%+ approve a sale of the Company, all shareholders must sell (drag-along)."]

## 6. Deadlock Resolution
If shareholders are evenly split on a major decision, [describe resolution mechanism — e.g. mediation, a casting vote, buyout option].

## 7. Exit / Buyout
[Describe what happens if a shareholder wants to leave, dies, or is terminated as an employee — valuation method and payment terms.]

## 8. Governing Law
This Agreement is governed by the laws of [State/Country].

---
[Each shareholder signs:]
Shareholder: ______________________  Date: ____________

*This document is provided for informational and educational purposes only and does not constitute legal advice. Transfer restrictions, drag-along rights, and deadlock provisions are exactly the terms that matter most when a real dispute happens — have a licensed corporate attorney draft or review the final version.*`,
  },
  {
    slug: "rma-form-template",
    name: "RMA Form (Return Merchandise Authorization)",
    seoTitle: "Free RMA Form Template",
    description: "Free return merchandise authorization (RMA) form template for processing a product return or exchange.",
    category: "Business",
    bodyMarkdown: `# Return Merchandise Authorization (RMA)

**RMA #:** [Number] · **Date issued:** [Date]

## Customer Information
Name: [Name] · Order #: [Number] · Order date: [Date]

## Item(s) Being Returned

| Item | SKU | Qty | Reason for Return |
|------|-----|-----|---------------------|
| [Item] | [SKU] | [Qty] | [Reason] |

## Requested Resolution
[ ] Refund  [ ] Exchange  [ ] Store Credit  [ ] Repair

## Return Shipping Instructions
Return to: [Address]
[Include the RMA # on the outside of the package / use the prepaid label attached]

## Approval
Authorized by: [Name] · Date: [Date]
RMA valid until: [Date — RMAs typically expire after 30 days]

*Requiring an RMA number before accepting a return keeps unexpected packages from showing up with no order/reason attached — attach it to your return policy on your site or receipts.*`,
  },
  {
    slug: "confirmation-letter-template",
    name: "Confirmation Letter",
    seoTitle: "Free Confirmation Letter Template",
    description: "Free confirmation letter template for confirming a booking, appointment, order, or verbal agreement in writing.",
    category: "Business",
    bodyMarkdown: `# Confirmation Letter

[Date]

Dear [Recipient Name],

This letter confirms [what's being confirmed — e.g. "our appointment on [Date] at [Time]" or "your order #[Number], placed on [Date]"].

## Details
- [Detail 1 — e.g. date/time/location]
- [Detail 2 — e.g. amount/quantity]
- [Detail 3 — e.g. any conditions]

If any of the above is incorrect, please contact me at [Phone/Email] as soon as possible.

We look forward to [next step].

Sincerely,
[Your Name]

*A short confirmation in writing — even just an email — is often what actually gets referenced if there's ever a disagreement about what was agreed verbally.*`,
  },
  {
    slug: "risk-management-plan-template",
    name: "Risk Management Plan",
    seoTitle: "Free Risk Management Plan Template",
    description: "Free risk management plan template identifying, assessing, and planning responses to project or business risks.",
    category: "Business",
    bodyMarkdown: `# Risk Management Plan: [Project/Business Name]

**Prepared by:** [Name] · **Date:** [Date]

## Risk Register

| # | Risk | Likelihood | Impact | Response Strategy | Owner |
|---|------|------------|--------|----------------------|-------|
| 1 | [Risk] | [Low/Med/High] | [Low/Med/High] | [Avoid/Mitigate/Transfer/Accept] | [Name] |
| 2 | [Risk] | [Low/Med/High] | [Low/Med/High] | [Strategy] | [Name] |

## Monitoring
[How often the risk register is reviewed, and by whom.]

## Escalation
[When and how a risk gets escalated to leadership — e.g. "any risk reaching High/High gets flagged to the sponsor immediately."]

*The response strategy column is where most risk registers go generic ("monitor closely") — force a real answer: avoid it, reduce it, insure/contract it away, or knowingly accept it.*`,
  },
  {
    slug: "software-requirements-specification-template",
    name: "Software Requirements Specification (SRS)",
    seoTitle: "Free Software Requirements Specification (SRS) Template",
    description: "Free SRS template defining what a piece of software must do before development starts.",
    category: "Business",
    bodyMarkdown: `# Software Requirements Specification: [Product Name]

**Version:** [Number] · **Date:** [Date] · **Author:** [Name]

## 1. Purpose
[What this software is for, and who it's for.]

## 2. Scope
**In scope:** [Features/functions covered]
**Out of scope:** [What's explicitly not part of this version]

## 3. Functional Requirements
| ID | Requirement | Priority |
|----|-------------|-----------|
| FR-1 | [The system shall...] | [Must/Should/Could] |
| FR-2 | [The system shall...] | [Must/Should/Could] |

## 4. Non-Functional Requirements
[Performance, security, availability, scalability expectations.]

## 5. User Roles
[Who uses the system and what each role can do.]

## 6. Constraints
[Technical, budget, or timeline constraints that shape the design.]

## 7. Assumptions and Dependencies
[What this spec assumes to be true, and any external dependencies.]

*Requirements written as testable statements ("the system shall...") are far easier to verify at launch than vague goals — if you can't write a test for it, it's not specific enough yet.*`,
  },
  {
    slug: "distribution-agreement-template",
    name: "Distribution Agreement",
    seoTitle: "Free Distribution Agreement Template",
    description: "Free distribution agreement template appointing a distributor to sell your products in a defined territory.",
    category: "Business",
    bodyMarkdown: `# Distribution Agreement

**Supplier:** [Company Name]
**Distributor:** [Company Name]
**Effective Date:** [Date]

## 1. Appointment
Supplier appoints Distributor as [exclusive/non-exclusive] distributor of [Products] within [Territory].

## 2. Pricing and Orders
Distributor purchases Products at [Wholesale price/discount structure]. Orders are placed via [Process] and fulfilled within [Timeframe].

## 3. Minimum Purchase Requirements
[Optional: "Distributor agrees to purchase at least [Amount/Quantity] per [Period] to maintain exclusivity."]

## 4. Marketing
[Who is responsible for marketing in the territory, and use of Supplier's trademarks/branding.]

## 5. Term and Termination
This Agreement runs for [Term] and may be terminated by either party with [Notice Period] notice, or immediately for [material breach / insolvency].

## 6. Intellectual Property
Distributor may use Supplier's trademarks only in connection with selling the Products, and only during the term of this Agreement.

## 7. Governing Law
This Agreement is governed by the laws of [State/Country].

---
Supplier: ______________________  Date: ____________
Distributor: ______________________  Date: ____________

*This document is provided for informational and educational purposes only and does not constitute legal advice. Exclusivity and minimum-purchase terms are the two most contested parts of these deals — have a licensed attorney review before granting exclusive territory rights.*`,
  },
  {
    slug: "donation-letter-template",
    name: "Donation Letter",
    seoTitle: "Free Donation Letter Template",
    description: "Free donation request/acknowledgment letter template for a nonprofit or fundraising campaign.",
    category: "Business",
    bodyMarkdown: `# Donation Request Letter

[Organization Name]
[Date]

Dear [Donor Name],

[Opening: a specific, human reason this cause matters — not just "we need money."]

## The need
[What the funds will be used for, specifically.]

## The ask
We're asking for a donation of [Suggested amount / "any amount"] to help us [specific goal].

## Impact
[What a donation actually accomplishes — e.g. "$50 provides X."]

## How to give
[Donation method — link, mail-in, in person.]

Thank you for considering this. [Organization Name] is a [501(c)(3) / other status] and your donation may be tax-deductible.

Sincerely,
[Your Name/Title]

---
*Donation Acknowledgment (send after receiving a gift):*

Dear [Donor Name],

Thank you for your generous gift of [Amount] on [Date]. [Organization Name] did not provide goods or services in exchange for this contribution, and this letter may serve as your tax receipt.

[Organization Name] · [Tax ID/EIN]

*If you're a US nonprofit, the acknowledgment letter's exact wording matters for the donor's tax deduction (specifically the "no goods or services" language, or a description of what was provided if anything was) — check current IRS guidance for gifts over $250.*`,
  },
  {
    slug: "securities-purchase-agreement-template",
    name: "Securities Purchase Agreement",
    seoTitle: "Free Securities Purchase Agreement Template",
    description: "Free securities purchase agreement template outline for a startup raising money by selling shares or notes to an investor.",
    category: "Finance",
    bodyMarkdown: `# Securities Purchase Agreement

**Company:** [Company Name]
**Investor:** [Investor Name]
**Date:** [Date]

## 1. Purchase and Sale
Company agrees to sell, and Investor agrees to purchase, [Number/type of securities — e.g. shares of Series Seed Preferred Stock] for a total purchase price of [Amount].

## 2. Closing
The closing will occur on [Date], subject to [any closing conditions].

## 3. Representations by Company
Company represents that: it is duly organized and in good standing, it has the authority to issue these securities, and [other standard reps — e.g. no undisclosed litigation].

## 4. Representations by Investor
Investor represents that they are purchasing for their own account and [if applicable: qualify as an "accredited investor" under applicable securities law].

## 5. Use of Proceeds
[Optional: describe how funds will be used.]

## 6. Governing Law
This Agreement is governed by the laws of [State].

---
Company: ______________________  Date: ____________
Investor: ______________________  Date: ____________

*This document is provided for informational and educational purposes only and does not constitute legal advice. Selling securities triggers real securities-law obligations (federal and state) even for a small friends-and-family round — use a licensed securities attorney before raising any outside money.*`,
  },
  {
    slug: "sponsorship-agreement-template",
    name: "Sponsorship Agreement",
    seoTitle: "Free Sponsorship Agreement Template",
    description: "Free sponsorship agreement template for a business sponsoring an event, team, or organization.",
    category: "Business",
    bodyMarkdown: `# Sponsorship Agreement

**Sponsor:** [Company Name]
**Sponsored Party:** [Event/Team/Organization Name]
**Date:** [Date]

## 1. Sponsorship
Sponsor agrees to provide [Amount, or goods/services value] in exchange for the benefits described below, in connection with [Event/Season/Program Name].

## 2. Sponsorship Benefits
[List specifically — e.g. logo placement, mentions, booth space, tickets, social media posts — with quantities/sizes/frequency where relevant.]

## 3. Payment
Sponsorship fee is due: [Timing — e.g. "50% upon signing, 50% 30 days before the event"].

## 4. Term
This Agreement covers [Event date(s) / Season], [and any renewal terms].

## 5. Use of Marks
Sponsored Party may use Sponsor's name/logo only as described above and only during the term of this Agreement.

## 6. Cancellation
[What happens if the event is cancelled — partial refund, credit toward a future event, etc.]

---
Sponsor: ______________________  Date: ____________
Sponsored Party: ______________________  Date: ____________

*Listing sponsorship benefits with specific numbers (how many logo placements, what size, how many social posts) avoids the most common sponsorship dispute — "that's not what I thought I was paying for."*`,
  },
  {
    slug: "certificate-of-origin-template",
    name: "Certificate of Origin",
    seoTitle: "Free Certificate of Origin Template",
    description: "Free certificate of origin template certifying the country where exported goods were manufactured, for customs purposes.",
    category: "Business",
    bodyMarkdown: `# Certificate of Origin

**Exporter:** [Name, Address]
**Consignee:** [Name, Address]
**Invoice #:** [Number] · **Date:** [Date]

## Goods

| Description | HS Code | Quantity | Country of Origin |
|-------------|---------|----------|----------------------|
| [Description] | [Code] | [Qty] | [Country] |

## Declaration
I, the undersigned, certify that the goods described above originate in the country stated, and that the information provided is true and accurate to the best of my knowledge.

Signature: ______________________  Date: ____________
[Name, Title]
[Company Name]

[If required: Chamber of Commerce stamp/certification block]

*Many trade agreements require a specific, government-provided certificate of origin form (not a generic one) to claim preferential tariff rates — check with your customs broker or the relevant Chamber of Commerce before shipping.*`,
  },
  {
    slug: "case-study-template",
    name: "Case Study",
    seoTitle: "Free Case Study Template",
    description: "Free case study template for showcasing a customer's results using your product or service.",
    category: "Business",
    bodyMarkdown: `# Case Study: [Customer Name]

## The Challenge
[What problem the customer was facing before working with you — specific, in their words if possible.]

## The Solution
[What you did — the specific product/service and how it was implemented.]

## The Results
[Concrete, specific numbers — % improvement, time saved, revenue gained. Only include what you can actually back up.]

## Quote
"[A real quote from the customer, with their permission]"
— [Name, Title, Company]

## Summary
[One or two sentences tying the challenge, solution, and result together.]

*Get sign-off from the customer before publishing — both on the quote wording and any numbers you're attributing to them.*`,
  },
  {
    slug: "progress-report-template",
    name: "Progress Report",
    seoTitle: "Free Progress Report Template",
    description: "Free progress report template for updating a client or stakeholder on work completed against a plan.",
    category: "Business",
    bodyMarkdown: `# Progress Report: [Project Name]

**Reporting Period:** [Date] – [Date]
**Prepared by:** [Name]

## Summary
[One or two sentences: overall status in plain language.]

## Work Completed
[List specific deliverables/milestones completed this period.]

## Work In Progress
[What's actively being worked on.]

## Upcoming
[What's planned next period.]

## Issues / Blockers
[Anything slowing progress, and what's needed to resolve it.]

## Timeline
Original target: [Date] · Current estimate: [Date]

*Flag slippage against the ORIGINAL timeline every time, not just the most recently revised one — a project can look "on track" report after report while quietly drifting from where it started.*`,
  },
  {
    slug: "job-description-template",
    name: "Job Description",
    seoTitle: "Free Job Description Template",
    description: "Free job description template for a job posting or internal role definition.",
    category: "HR",
    bodyMarkdown: `# Job Description: [Job Title]

**Department:** [Department] · **Reports to:** [Manager Title]
**Employment type:** [Full-time/Part-time/Contract] · **Location:** [Location/Remote]

## About the Role
[2-3 sentences: what this role does and why it matters to the team/company.]

## Responsibilities
- [Responsibility 1]
- [Responsibility 2]
- [Responsibility 3]

## Requirements
- [Required skill/experience 1]
- [Required skill/experience 2]

## Nice to Have
- [Preferred but not required qualifications]

## Compensation & Benefits
[Salary range, and key benefits — pay transparency is legally required in some jurisdictions for job postings.]

## How to Apply
[Application instructions/link]

*Listing 3-5 clear requirements works better than a long wish-list — an overloaded requirements section discourages qualified candidates who don't check every box.*`,
  },
  {
    slug: "termination-agreement-template",
    name: "Termination Agreement",
    seoTitle: "Free Termination Agreement Template",
    description: "Free termination agreement template for two parties mutually ending an existing contract early.",
    category: "Business",
    bodyMarkdown: `# Termination Agreement

**Party A:** [Name]
**Party B:** [Name]
**Original Agreement:** [Reference — name and date of the contract being terminated]
**Date:** [Date]

## 1. Mutual Termination
The parties agree to terminate the Original Agreement effective [Termination Date], by mutual consent.

## 2. Outstanding Obligations
[Describe what still needs to happen — e.g. "Party A will pay the outstanding balance of $[Amount] within [X] days" or "Party B will return all Company property by [Date]."]

## 3. Release
Upon satisfaction of Section 2, each party releases the other from further obligations under the Original Agreement, except for any provisions that expressly survive termination (e.g. confidentiality).

## 4. Surviving Provisions
[List any clauses from the original agreement that continue to apply — e.g. confidentiality, non-compete.]

## 5. Governing Law
This Agreement is governed by the laws of [State/Country].

---
Party A: ______________________  Date: ____________
Party B: ______________________  Date: ____________

*Being explicit about what survives (confidentiality is common) prevents an early termination from accidentally releasing obligations you meant to keep in place.*`,
  },
  {
    slug: "letter-of-inquiry-template",
    name: "Letter of Inquiry",
    seoTitle: "Free Letter of Inquiry Template",
    description: "Free letter of inquiry template for requesting information about a product, service, or opportunity.",
    category: "Business",
    bodyMarkdown: `# Letter of Inquiry

[Date]

[Recipient Name/Company]

Dear [Recipient Name],

I am writing to inquire about [product/service/opportunity].

## What I'd like to know
- [Question 1]
- [Question 2]
- [Question 3]

[Optional: brief context on why you're asking — e.g. your company, project, or timeline.]

I would appreciate a response by [Date, if there's a deadline]. Please let me know if you need any further information from me.

Thank you for your time.

Sincerely,
[Your Name]
[Contact Information]

*Listing your questions as a short, numbered list (rather than burying them in prose) makes it much easier for the recipient to reply point-by-point.*`,
  },
  {
    slug: "convertible-promissory-note-template",
    name: "Convertible Promissory Note",
    seoTitle: "Free Convertible Promissory Note Template",
    description: "Free convertible promissory note template — startup debt that converts into equity in a future financing round.",
    category: "Finance",
    bodyMarkdown: `# Convertible Promissory Note

**Company:** [Company Name]
**Investor:** [Investor Name]
**Principal Amount:** [Amount]
**Date:** [Date]

For value received, Company promises to pay Investor the Principal Amount, together with interest, subject to conversion as described below.

## 1. Interest
Interest accrues at [Rate]% per year, simple interest.

## 2. Maturity Date
Unless earlier converted, this Note is due on [Maturity Date].

## 3. Automatic Conversion
Upon a Qualified Financing (an equity round raising at least [Threshold Amount]), this Note automatically converts into the same securities sold in that round, at a price equal to the lesser of: (a) the round's price per share, or (b) the price implied by a valuation cap of [Amount] [and/or a discount of [%]].

## 4. Optional Conversion
[Optional: describe conversion terms if the Company is acquired or the Note matures without a Qualified Financing.]

## 5. No Interim Interest Payments
Interest accrues but is not paid in cash — it's added to principal for conversion purposes, unless the Note is repaid in cash at maturity.

## 6. Governing Law
This Note is governed by the laws of [State].

---
Company: ______________________  Date: ____________
Investor: ______________________  Date: ____________

*This document is provided for informational and educational purposes only and does not constitute legal advice. Convertible notes (and SAFEs, a related instrument) have real tax and securities-law implications — use a licensed startup/securities attorney rather than relying on a generic template for an actual fundraise.*`,
  },
  {
    slug: "letter-of-appointment-template",
    name: "Letter of Appointment",
    seoTitle: "Free Letter of Appointment Template",
    description: "Free letter of appointment template — formally confirming someone's appointment to a role, board, or position.",
    category: "HR",
    bodyMarkdown: `# Letter of Appointment

[Date]

Dear [Name],

We are pleased to confirm your appointment as [Title/Role] at [Organization Name], effective [Start Date].

## Terms of Appointment
- Reporting to: [Manager/Board]
- Term: [Duration, if fixed-term — e.g. board positions often are]
- Compensation: [Amount/structure, or "as per separate agreement"]
- Key responsibilities: [Brief summary]

Please confirm your acceptance by signing and returning a copy of this letter.

Congratulations, and welcome.

Sincerely,
[Name, Title]

---
Accepted:
[Appointee Name]: ______________________  Date: ____________

*For board or officer appointments specifically, check whether your bylaws require a formal board resolution in addition to (or instead of) this letter.*`,
  },
  {
    slug: "quitclaim-deed-template",
    name: "Quitclaim Deed",
    seoTitle: "Free Quitclaim Deed Template",
    description: "Free quitclaim deed template transferring a property owner's interest without warranting clear title.",
    category: "Real Estate",
    bodyMarkdown: `# Quitclaim Deed

**Grantor:** [Name] (transferring the interest)
**Grantee:** [Name] (receiving the interest)
**Property:** [Full legal description — get this from the current deed, not just the street address]
**Date:** [Date]

For consideration of [Amount, or "$1.00 and other good and valuable consideration" for a gift/family transfer], Grantor hereby quitclaims to Grantee all of Grantor's right, title, and interest in the Property described above.

**This deed transfers only whatever interest the Grantor has — it makes no promise that the title is clear or free of other claims.**

---
Grantor signature: ______________________  Date: ____________

[Notarization block — required in virtually all states for a deed to be recordable]

*This document is provided for informational and educational purposes only and does not constitute legal advice. A quitclaim deed must be properly notarized and recorded with your county to be effective, and it does NOT protect the Grantee the way a warranty deed does — for a family transfer this is common, but for a purchase, most buyers want a warranty deed and title insurance instead.*`,
  },
  {
    slug: "project-budget-template",
    name: "Project Budget",
    seoTitle: "Free Project Budget Template",
    description: "Free project budget template for estimating and tracking costs against a project plan.",
    category: "Finance",
    bodyMarkdown: `# Project Budget: [Project Name]

**Prepared by:** [Name] · **Date:** [Date]

## Budget Summary

| Category | Estimated | Actual | Variance |
|----------|-----------|--------|-----------|
| Labor | [Amount] | [Amount] | [Amount] |
| Materials/Supplies | [Amount] | [Amount] | [Amount] |
| Equipment | [Amount] | [Amount] | [Amount] |
| Contingency ([%]) | [Amount] | [Amount] | [Amount] |
| **Total** | **[Amount]** | **[Amount]** | **[Amount]** |

## Assumptions
[Key assumptions the estimate relies on — e.g. hourly rates used, quantities assumed.]

## Funding Source
[Where the money is coming from — client payment, internal budget, grant, etc.]

## Approval
Approved by: ______________________  Date: ____________

*Building in a contingency line (commonly 10-20%) up front is more honest than pretending the estimate will be exact — and it avoids an awkward mid-project conversation when it isn't.*`,
  },
  {
    slug: "personal-loan-agreement-template",
    name: "Personal Loan Agreement",
    seoTitle: "Free Personal Loan Agreement Template",
    description: "Free personal loan agreement template for lending money to a friend or family member, in writing.",
    category: "Finance",
    bodyMarkdown: `# Personal Loan Agreement

**Lender:** [Name]
**Borrower:** [Name]
**Date:** [Date]
**Loan Amount:** [Amount]

## 1. Loan
Lender agrees to loan Borrower [Amount] on [Date].

## 2. Repayment
Borrower will repay the loan as follows: [Choose one: "in full by [Date]" or "in [Number] monthly installments of [Amount], starting [Date]"].

## 3. Interest
[Choose one: "This loan is interest-free, between family/friends." OR "Interest accrues at [Rate]% per year."]

## 4. Late Payments
If a payment is more than [Number] days late, [describe consequence — e.g. a small late fee, or simply a conversation before anything else].

## 5. Early Repayment
Borrower may repay some or all of the loan early without penalty.

## 6. Acknowledgment
Both parties confirm this is the complete agreement between them regarding this loan.

---
Lender: ______________________  Date: ____________
Borrower: ______________________  Date: ____________

*Putting a personal loan in writing — even between family — protects the relationship as much as the money; it removes the "I don't remember agreeing to that" problem entirely.*`,
  },
  {
    slug: "referral-form-template",
    name: "Referral Form",
    seoTitle: "Free Referral Form Template",
    description: "Free referral form template for a customer or partner referral program.",
    category: "Business",
    bodyMarkdown: `# Referral Form

**Referred by:** [Your Name] · **Date:** [Date]
**Your email (for referral reward tracking):** [Email]

## Referral Details
Referred person/company: [Name]
Contact info: [Email/Phone]
How do you know them: [Relationship]
Why you think they're a good fit: [Brief note, optional]

## Referral Program Terms
[Your program's specific terms — e.g. "You'll receive [Reward] once the referral becomes a paying customer."]

Submitted by: ______________________  Date: ____________

*State the reward and the trigger for earning it (signup vs. first payment vs. X months retained) right on the form — vague referral terms are the #1 reason referral programs generate ill will instead of goodwill.*`,
  },
  {
    slug: "letter-of-interest-template",
    name: "Letter of Interest",
    seoTitle: "Free Letter of Interest Template",
    description: "Free letter of interest template for reaching out about a job opportunity that hasn't been posted.",
    category: "HR",
    bodyMarkdown: `# Letter of Interest

[Your Name]
[Your Email] · [Your Phone]
[Date]

Dear [Hiring Manager Name / "Hiring Team"],

I'm writing to express interest in potential opportunities at [Company Name], even though I didn't see a specific posting that matches my background.

## Why [Company Name]
[Something specific about the company that genuinely interests you — shows you're not sending this everywhere.]

## What I bring
[1-2 sentences on your relevant background/skills — treat this like a compressed cover letter.]

I've attached my resume and would welcome the chance to talk about how I might contribute, even informally.

Thank you for your time.

Sincerely,
[Your Name]

*A letter of interest works best when it's clearly researched and specific to the company — a generic version of this reads exactly like the mass-blast it is.*`,
  },
  {
    slug: "loan-agreement-template",
    name: "Loan Agreement",
    seoTitle: "Free Loan Agreement Template",
    description: "Free general loan agreement template for a business or personal loan, more detailed than a simple promissory note.",
    category: "Finance",
    bodyMarkdown: `# Loan Agreement

**Lender:** [Name]
**Borrower:** [Name]
**Date:** [Date]
**Principal Amount:** [Amount]

## 1. Loan and Purpose
Lender agrees to loan Borrower [Amount], to be used for [Purpose, if restricted].

## 2. Interest Rate
Interest accrues at [Rate]% per year, [simple/compound], calculated on the outstanding balance.

## 3. Repayment Schedule
| Payment # | Due Date | Amount |
|-----------|----------|--------|
| 1 | [Date] | [Amount] |
| 2 | [Date] | [Amount] |

## 4. Collateral (if any)
[Describe any collateral securing this loan, or state "This loan is unsecured."]

## 5. Default
Borrower is in default if any payment is more than [Number] days late. Upon default, Lender may declare the full remaining balance due immediately and pursue any remedy available under [State] law.

## 6. Prepayment
Borrower may repay the loan in full or in part at any time without penalty.

## 7. Governing Law
This Agreement is governed by the laws of [State/Country].

---
Lender: ______________________  Date: ____________
Borrower: ______________________  Date: ____________

*This document is provided for informational and educational purposes only and does not constitute legal advice. Interest rates above your state's usury limit can make a loan unenforceable or even illegal — check your state's cap before setting the rate, especially for non-bank lenders.*`,
  },
  {
    slug: "event-planning-worksheet-template",
    name: "Event Planning Worksheet",
    seoTitle: "Free Event Planning Worksheet Template",
    description: "Free event planning worksheet template for tracking vendors, budget, and timeline for an event.",
    category: "Business",
    bodyMarkdown: `# Event Planning Worksheet: [Event Name]

**Date:** [Event Date] · **Location:** [Venue]
**Expected guests:** [Number]

## Budget
| Category | Estimated | Actual |
|----------|-----------|--------|
| Venue | [Amount] | [Amount] |
| Catering | [Amount] | [Amount] |
| Decor | [Amount] | [Amount] |
| Entertainment | [Amount] | [Amount] |
| Other | [Amount] | [Amount] |
| **Total** | **[Amount]** | **[Amount]** |

## Vendors
| Vendor | Service | Contact | Deposit Paid | Balance Due |
|--------|---------|---------|----------------|--------------|
| [Vendor] | [Service] | [Contact] | [Amount/Date] | [Amount/Date] |

## Timeline
| Task | Deadline | Status |
|------|----------|--------|
| [Task] | [Date] | [ ] |

## Day-Of Schedule
| Time | Activity |
|------|----------|
| [Time] | [Activity] |

*Track deposit AND balance due dates per vendor separately — missed final payments right before an event are one of the most common last-minute event fires.*`,
  },
  {
    slug: "commitment-letter-template",
    name: "Commitment Letter",
    seoTitle: "Free Commitment Letter Template",
    description: "Free loan commitment letter template — a lender's written commitment to provide financing, subject to conditions.",
    category: "Finance",
    bodyMarkdown: `# Commitment Letter

[Lender Name/Letterhead]
[Date]

[Borrower Name]
[Borrower Address]

**RE: Commitment to Provide Financing — [Loan/Property Reference]**

Dear [Borrower Name],

We are pleased to commit to providing financing under the following terms, subject to the conditions below.

## Loan Terms
- Loan amount: [Amount]
- Interest rate: [Rate]
- Term: [Duration]
- Purpose: [Use of funds]

## Conditions to Closing
This commitment is subject to: [e.g. satisfactory appraisal, title review, final underwriting approval, no material change in Borrower's financial condition].

## Expiration
This commitment expires on [Date] if not accepted and closed by then.

## Fees
[Commitment fee, if any, and when it's due/refundable.]

Sincerely,
[Lender Name/Title]

---
Accepted:
[Borrower Name]: ______________________  Date: ____________

*A commitment letter is conditional, not a guarantee — read the "Conditions to Closing" section carefully, since any of those unmet conditions can still allow the lender to walk away.*`,
  },
  {
    slug: "construction-loan-agreement-template",
    name: "Construction Loan Agreement",
    seoTitle: "Free Construction Loan Agreement Template",
    description: "Free construction loan agreement template — financing disbursed in stages as construction milestones are completed.",
    category: "Real Estate",
    bodyMarkdown: `# Construction Loan Agreement

**Lender:** [Name]
**Borrower:** [Name]
**Property:** [Address/Legal Description]
**Date:** [Date]
**Total Loan Amount:** [Amount]

## 1. Purpose
This loan finances construction of [Description of project] on the Property.

## 2. Disbursement Schedule
Funds are disbursed in draws as construction milestones are completed and verified:

| Draw # | Milestone | Amount |
|--------|-----------|--------|
| 1 | [e.g. Foundation complete] | [Amount] |
| 2 | [e.g. Framing complete] | [Amount] |
| 3 | [e.g. Final completion] | [Amount] |

## 3. Inspections
Before each draw, [Lender/Lender's inspector] will verify the milestone is complete.

## 4. Interest
Interest accrues only on funds actually disbursed, at [Rate]% per year, during the construction period.

## 5. Conversion to Permanent Financing
[If applicable: describe how/when this converts to a standard mortgage upon completion.]

## 6. Default
[Describe what constitutes default — e.g. construction significantly behind schedule, budget overrun beyond an agreed threshold, failure to maintain insurance.]

## 7. Governing Law
This Agreement is governed by the laws of [State].

---
Lender: ______________________  Date: ____________
Borrower: ______________________  Date: ____________

*This document is provided for informational and educational purposes only and does not constitute legal advice. Construction loans are technically and legally complex (lien priority, inspection standards, draw disputes) — use a licensed attorney and a qualified lender rather than a DIY agreement for an actual project.*`,
  },
  {
    slug: "medical-history-form-template",
    name: "Medical History Form",
    seoTitle: "Free Medical History Form Template",
    description: "Free medical history form template for a new patient, camp, or program requiring health background.",
    category: "HR",
    bodyMarkdown: `# Medical History Form

**Name:** [Name] · **Date of Birth:** [Date]
**Emergency Contact:** [Name, Phone, Relationship]

## Medical Information
Known allergies: [List, or "None"]
Current medications: [List, or "None"]
Chronic conditions: [List, or "None"]
Past surgeries/hospitalizations: [List, or "None"]

## Physician
Name: [Name] · Phone: [Phone]

## Insurance
Provider: [Name] · Policy #: [Number]

## Additional Notes
[Anything else relevant — dietary restrictions, mobility considerations, etc.]

## Consent
I certify the above information is accurate and authorize its use for the purpose of [providing care / participating in program].

Signature: ______________________  Date: ____________
[If minor] Parent/Guardian: ______________________

*Medical history forms often contain protected health information — store and share them securely, and only with people who genuinely need access (e.g. on-site staff during an emergency).*`,
  },
  {
    slug: "service-level-agreement-template",
    name: "Service Level Agreement (SLA)",
    seoTitle: "Free Service Level Agreement (SLA) Template",
    description: "Free SLA template defining measurable service commitments — uptime, response time, and remedies if they're missed.",
    category: "Business",
    bodyMarkdown: `# Service Level Agreement (SLA)

**Provider:** [Company Name]
**Client:** [Client Name]
**Effective Date:** [Date]
**Related Agreement:** [Reference to the underlying services agreement]

## 1. Service Commitments

| Metric | Commitment | Measurement Period |
|--------|-------------|-----------------------|
| Uptime | [e.g. 99.9%] | Monthly |
| Response time (critical issue) | [e.g. within 1 hour] | Per incident |
| Response time (standard issue) | [e.g. within 1 business day] | Per incident |
| Resolution time | [e.g. within 3 business days] | Per incident |

## 2. Severity Levels
[Define what counts as "critical" vs "standard" — e.g. "Critical = service unavailable to all users."]

## 3. Measurement and Reporting
[How uptime/response time is measured and reported — e.g. monthly report, third-party monitoring tool.]

## 4. Remedies for Missed Commitments
If Provider fails to meet the commitments above: [e.g. service credit of X% of monthly fee per Y% of downtime below target, up to a maximum of Z%].

## 5. Exclusions
This SLA does not apply to downtime caused by: [scheduled maintenance with advance notice, Client's own systems, force majeure events].

## 6. Review
This SLA will be reviewed [Frequency] and may be updated by mutual written agreement.

---
Provider: ______________________  Date: ____________
Client: ______________________  Date: ____________

*Vague commitments ("high availability," "fast response") are unenforceable in practice — every metric here needs a number and a measurement method, or it's not really an SLA.*`,
  },
  {
    slug: "membership-form-template",
    name: "Membership Form",
    seoTitle: "Free Membership Form Template",
    description: "Free membership application form template for a club, association, or membership organization.",
    category: "Business",
    bodyMarkdown: `# Membership Application

**Organization:** [Organization Name]

## Applicant Information
Name: [Name] · Email: [Email] · Phone: [Phone]
Address: [Address]

## Membership Type
[ ] Individual  [ ] Family  [ ] Student  [ ] Corporate — [Tier/pricing if applicable]

## Fees
Membership fee: [Amount] per [Year/Month]
Payment method: [Method]

## Why do you want to join?
[Optional field, if relevant to your organization]

## Referred by (if applicable)
[Name of existing member, if you have a referral program]

## Agreement
I agree to abide by the organization's bylaws and code of conduct.

Signature: ______________________  Date: ____________

*Keep the form short — every extra required field measurably reduces how many people finish filling it out.*`,
  },
  {
    slug: "nonprofit-club-constitution-and-bylaws-template",
    name: "Nonprofit / Club Constitution and Bylaws",
    seoTitle: "Free Nonprofit or Club Constitution and Bylaws Template",
    description: "Free constitution and bylaws template for a nonprofit, club, or membership association's governing rules.",
    category: "Legal",
    bodyMarkdown: `# Constitution and Bylaws of [Organization Name]

## Article 1: Name and Purpose
The name of this organization is [Name]. Its purpose is: [Mission/purpose statement].

## Article 2: Membership
Membership is open to [eligibility criteria]. Members must [dues/requirements, if any].

## Article 3: Officers
Officers are: [President, Vice President, Secretary, Treasurer]. Officers are elected [Frequency] by [voting process].

## Article 4: Meetings
Regular meetings are held [Frequency]. A quorum consists of [Number/percentage] of members. Special meetings may be called by [Officer/petition of X members].

## Article 5: Voting
Each member is entitled to [one vote]. Decisions require [majority/two-thirds] approval unless otherwise stated.

## Article 6: Finances
[How dues/funds are collected and managed, and who has signing authority on accounts.]

## Article 7: Amendments
This Constitution may be amended by a vote of [%] of members present at a meeting where the proposed amendment was included in the meeting notice.

## Article 8: Dissolution
If dissolved, remaining assets will be [distributed to members / donated to a similar nonprofit — required for 501(c)(3) organizations].

---
Adopted on [Date] by vote of the membership.

*If you're pursuing US 501(c)(3) nonprofit status, the IRS has specific required language (especially for the purpose and dissolution clauses) — check current Form 1023 instructions before filing, or have a nonprofit attorney review.*`,
  },
  {
    slug: "hardship-letter-template",
    name: "Hardship Letter",
    seoTitle: "Free Hardship Letter Template",
    description: "Free hardship letter template for requesting a payment plan, loan modification, or fee waiver due to financial hardship.",
    category: "Finance",
    bodyMarkdown: `# Hardship Letter

[Your Name]
[Date]

[Lender/Landlord/Creditor Name]

**RE: Request for [Payment Plan / Loan Modification / Fee Waiver] — Account #[Number]**

Dear [Recipient Name],

I am writing to request [specific ask — e.g. "a temporary reduction in my monthly payment" or "a waiver of the late fee on my account"] due to financial hardship.

## What happened
[Brief, factual explanation — job loss, medical issue, reduced hours. Specific but doesn't need to be exhaustive.]

## My request
[Exactly what you're asking for — a specific new payment amount, a specific waiver, a specific timeframe.]

## Supporting information
[Reference any documentation you're attaching — pay stubs, medical bills, termination letter.]

I have been a [customer/tenant/borrower] in good standing and am committed to resolving this. I would appreciate the opportunity to discuss options.

Sincerely,
[Your Name]
[Contact Information]

*Being specific about the exact accommodation you're asking for (not just "please help") gives the reader something concrete to say yes to.*`,
  },
  {
    slug: "engagement-letter-template",
    name: "Engagement Letter",
    seoTitle: "Free Engagement Letter Template",
    description: "Free engagement letter template for a professional services firm (accounting, legal, consulting) to define scope with a new client.",
    category: "Business",
    bodyMarkdown: `# Engagement Letter

[Firm Name/Letterhead]
[Date]

[Client Name]
[Client Address]

Dear [Client Name],

This letter confirms the terms of our engagement to provide [Description of services] for [Client Name].

## Scope of Services
[Specifically what is — and isn't — included.]

## Fees
[Fee structure — hourly, flat fee, retainer — and billing frequency.]

## Responsibilities
**We will:** [List]
**You will:** [e.g. provide requested documents/information in a timely manner]

## Confidentiality
We will keep your information confidential, consistent with our professional obligations.

## Limitation of Liability
[If applicable to your profession/jurisdiction — often standard in accounting/consulting engagement letters.]

## Term
This engagement begins [Date] and continues until [completion of the described services / terminated by either party with notice].

If these terms are acceptable, please sign below.

Sincerely,
[Firm representative name]

---
Accepted:
[Client Name]: ______________________  Date: ____________

*An engagement letter that clearly states what's NOT included is what actually prevents scope-creep disputes later — be as specific about exclusions as about what's covered.*`,
  },
  {
    slug: "construction-contract-template",
    name: "Construction Contract",
    seoTitle: "Free Construction Contract Template",
    description: "Free construction contract template for a home renovation or building project between an owner and contractor.",
    category: "Legal",
    bodyMarkdown: `# Construction Contract

**Owner:** [Name]
**Contractor:** [Name, License #]
**Project:** [Address/Description]
**Date:** [Date]

## 1. Scope of Work
Contractor will perform: [Detailed description of the work, including materials/specifications].

## 2. Contract Price
Total contract price: [Amount], payable as: [Payment schedule tied to milestones, e.g. "10% deposit, 30% at framing, 30% at drywall, 30% at completion"].

## 3. Timeline
Work begins: [Date] · Estimated completion: [Date]

## 4. Change Orders
Any change to the scope, materials, or price must be documented in a signed change order before the additional work begins.

## 5. Permits
[Who is responsible for obtaining permits — typically the licensed contractor.]

## 6. Warranty
Contractor warrants the work against defects for [Duration] from completion.

## 7. Insurance
Contractor maintains [general liability / workers' compensation] insurance and will provide proof upon request.

## 8. Dispute Resolution
Disputes will be addressed through [mediation/arbitration] before litigation.

---
Owner: ______________________  Date: ____________
Contractor: ______________________  Date: ____________

*This document is provided for informational and educational purposes only and does not constitute legal advice. Construction contracts are regulated at the state level (licensing, required disclosures, lien rights) — for anything beyond a small job, use a state-specific contract or have an attorney review this one.*`,
  },
  {
    slug: "offer-to-purchase-template",
    name: "Offer to Purchase (Real Estate)",
    seoTitle: "Free Offer to Purchase (Real Estate) Template",
    description: "Free offer to purchase template for making a formal offer on a residential property.",
    category: "Real Estate",
    bodyMarkdown: `# Offer to Purchase Real Estate

**Buyer:** [Name]
**Seller:** [Name]
**Property:** [Address]
**Date:** [Date]

## 1. Purchase Price
Buyer offers to purchase the Property for [Amount].

## 2. Earnest Money
Buyer will deposit [Amount] in earnest money within [Number] days of acceptance, held by [Escrow/Title company].

## 3. Financing Contingency
This offer is contingent on Buyer securing financing of [Amount] within [Number] days. [Or: "This is a cash offer, no financing contingency."]

## 4. Inspection Contingency
Buyer has [Number] days from acceptance to conduct inspections and may withdraw or renegotiate based on findings.

## 5. Closing
Closing will occur on or before [Date], at [Location/via title company].

## 6. Included Items
[Fixtures/appliances included in the sale, if any beyond what's legally attached.]

## 7. Offer Expiration
This offer expires if not accepted in writing by [Date/Time].

---
Buyer: ______________________  Date: ____________
Seller acceptance: ______________________  Date: ____________

*This document is provided for informational and educational purposes only and does not constitute legal advice. Most US states require real estate purchase offers to use state-mandated forms with specific disclosures — this is a structural starting point, not a substitute for your state's required form or a real estate agent/attorney.*`,
  },
  {
    slug: "due-diligence-checklist-template",
    name: "Due Diligence Checklist",
    seoTitle: "Free Due Diligence Checklist Template",
    description: "Free due diligence checklist template for reviewing a business before an acquisition, investment, or partnership.",
    category: "Business",
    bodyMarkdown: `# Due Diligence Checklist: [Target Company Name]

**Prepared by:** [Name] · **Date:** [Date]

## Financial
- [ ] 3 years of financial statements reviewed
- [ ] Tax returns reviewed
- [ ] Accounts receivable/payable aging reviewed
- [ ] Debt and lease obligations identified

## Legal
- [ ] Corporate formation documents reviewed
- [ ] Material contracts reviewed
- [ ] Litigation history checked
- [ ] IP ownership confirmed

## Operational
- [ ] Key customer concentration assessed
- [ ] Key employee retention risk assessed
- [ ] Supplier dependencies identified

## HR
- [ ] Employee agreements/handbook reviewed
- [ ] Outstanding HR complaints/claims checked

## Other
- [ ] Insurance coverage reviewed
- [ ] Real estate/lease obligations reviewed

## Findings Summary
[Space to note red flags or items requiring follow-up]

*A checklist only works if unchecked items get an actual answer before closing — "N/A" and "still pending" look identical on paper but mean very different things at closing.*`,
  },
  {
    slug: "risk-assessment-template",
    name: "Risk Assessment",
    seoTitle: "Free Risk Assessment Template",
    description: "Free risk assessment template for identifying workplace hazards and the controls in place to manage them.",
    category: "Business",
    bodyMarkdown: `# Risk Assessment

**Area/Activity Assessed:** [Description]
**Assessed by:** [Name] · **Date:** [Date]

## Hazards Identified

| Hazard | Who's at Risk | Current Controls | Risk Level (Low/Med/High) | Further Action Needed |
|--------|-----------------|---------------------|------------------------------|---------------------------|
| [Hazard] | [Group] | [Controls in place] | [Level] | [Action] |
| [Hazard] | [Group] | [Controls in place] | [Level] | [Action] |

## Overall Risk Rating
[Summary rating for the area/activity as a whole]

## Review Date
This assessment should be reviewed by [Date], or sooner if conditions change.

---
Reviewed by: ______________________  Date: ____________

*A risk assessment that's never revisited becomes inaccurate the moment anything changes — set an actual review date rather than leaving it open-ended.*`,
  },
  {
    slug: "inspection-checklist-template",
    name: "Inspection Checklist",
    seoTitle: "Free Inspection Checklist Template",
    description: "Free inspection checklist template for a property, equipment, or site walkthrough.",
    category: "Real Estate",
    bodyMarkdown: `# Inspection Checklist

**Property/Item:** [Description] · **Date:** [Date]
**Inspector:** [Name]

## Checklist

| Item | Condition (Good/Fair/Poor/N/A) | Notes |
|------|-----------------------------------|-------|
| [Item 1] | | |
| [Item 2] | | |
| [Item 3] | | |
| [Item 4] | | |

## Photos
[Note that photos were taken for any item marked Fair/Poor, with reference numbers]

## Summary
[Overall condition summary and any urgent items requiring immediate attention]

## Sign-off
Inspector: ______________________  Date: ____________

*Customize the item list to what you're actually inspecting (rental unit, vehicle, equipment, construction site) — a generic checklist is only a starting structure, not the real list.*`,
  },
  {
    slug: "certificate-of-insurance-request-template",
    name: "Certificate of Insurance Request",
    seoTitle: "Free Certificate of Insurance Request Template",
    description: "Free certificate of insurance (COI) request template for asking a vendor or contractor to prove their insurance coverage.",
    category: "Business",
    bodyMarkdown: `# Certificate of Insurance Request

[Date]

[Vendor/Contractor Name]

Dear [Name],

Before we can proceed with [Project/Engagement], we require a Certificate of Insurance (COI) showing the following coverage:

## Required Coverage
- General Liability: minimum [Amount] per occurrence
- [If applicable] Workers' Compensation: as required by [State] law
- [If applicable] Professional Liability / E&O: minimum [Amount]
- [If applicable] Auto Liability: minimum [Amount]

## Additional Insured
Please name [Your Company Name] as an additional insured on the General Liability policy.

## Where to Send
Please have your insurance broker send the COI directly to [Email], or provide a copy for our records.

Please send this before [Date] so we can proceed as planned.

Thank you,
[Your Name]

*Requiring the COI be sent directly from the insurance broker (not just forwarded by the vendor) reduces the (rare but real) risk of a fabricated certificate.*`,
  },
  {
    slug: "assignment-and-assumption-agreement-template",
    name: "Assignment and Assumption Agreement",
    seoTitle: "Free Assignment and Assumption Agreement Template",
    description: "Free assignment and assumption agreement template — transfers rights and obligations under an existing contract to a new party.",
    category: "Legal",
    bodyMarkdown: `# Assignment and Assumption Agreement

**Assignor:** [Name] (currently party to the original contract)
**Assignee:** [Name] (taking over the rights/obligations)
**Original Contract:** [Reference — name and date]
**Date:** [Date]

## 1. Assignment
Assignor assigns to Assignee all of Assignor's rights, title, and interest in the Original Contract.

## 2. Assumption
Assignee accepts the assignment and assumes all of Assignor's obligations under the Original Contract, effective [Date].

## 3. Consent of Counterparty
[If the original contract requires the other party's consent to assign: "This assignment is subject to and conditioned upon the written consent of [Counterparty Name], attached."]

## 4. Release of Assignor
[Choose one: "Upon Counterparty's consent, Assignor is fully released from further obligations under the Original Contract." OR "Assignor remains secondarily liable if Assignee fails to perform."]

## 5. Representations
Assignor represents that the Original Contract is in good standing and that Assignor has the right to assign it.

## 6. Governing Law
This Agreement is governed by the laws of [State/Country].

---
Assignor: ______________________  Date: ____________
Assignee: ______________________  Date: ____________
[If required] Counterparty consent: ______________________  Date: ____________

*Check the original contract's own assignment clause first — many contracts explicitly require the other party's written consent before they can be assigned at all, regardless of what this document says.*`,
  },
  {
    slug: "sales-representative-agreement-template",
    name: "Sales Representative Agreement",
    seoTitle: "Free Sales Representative Agreement Template",
    description: "Free sales representative agreement template for an independent sales rep selling your products on commission.",
    category: "Business",
    bodyMarkdown: `# Sales Representative Agreement

**Company:** [Company Name]
**Representative:** [Name]
**Effective Date:** [Date]

## 1. Appointment
Company appoints Representative as a [exclusive/non-exclusive] sales representative for [Products/Territory].

## 2. Commission
Representative earns a commission of [%] on [collected revenue / net sales] from sales they generate, paid [Frequency].

## 3. Independent Contractor Status
Representative is an independent contractor, not an employee, and is responsible for their own taxes and expenses.

## 4. Representative's Duties
[Describe expectations — e.g. minimum activity level, reporting, use of Company's pricing/materials.]

## 5. Company's Duties
[e.g. providing product training, marketing materials, timely order fulfillment.]

## 6. Term and Termination
This Agreement runs for [Term] and may be terminated by either party with [Notice Period] written notice. Commissions on sales made before termination are still owed per the payment schedule.

## 7. Non-Compete / Non-Solicitation
[Optional, and only if genuinely necessary — describe any post-termination restrictions and their duration.]

## 8. Governing Law
This Agreement is governed by the laws of [State/Country].

---
Company: ______________________  Date: ____________
Representative: ______________________  Date: ____________

*This document is provided for informational and educational purposes only and does not constitute legal advice. What happens to commissions on deals "in progress" when the relationship ends is the most commonly disputed clause — spell it out explicitly rather than leaving it implied.*`,
  },
  {
    slug: "master-service-agreement-template",
    name: "Master Service Agreement (MSA)",
    seoTitle: "Free Master Service Agreement (MSA) Template",
    description: "Free master service agreement template — sets overall terms once, so individual projects can be added via short statements of work.",
    category: "Business",
    bodyMarkdown: `# Master Service Agreement

**Provider:** [Company Name]
**Client:** [Client Name]
**Effective Date:** [Date]

## 1. Purpose
This Master Service Agreement ("MSA") sets the general terms governing all work performed by Provider for Client. Specific projects will be described in individual Statements of Work ("SOWs") that reference this MSA.

## 2. Order of Precedence
If an SOW conflicts with this MSA, the SOW controls for that specific project only.

## 3. Payment Terms
Unless a specific SOW states otherwise, invoices are due [Net 30] from the invoice date.

## 4. Intellectual Property
[Default IP ownership terms — e.g. "Work product created under any SOW belongs to Client upon full payment, unless that SOW states otherwise."]

## 5. Confidentiality
Both parties will keep the other's confidential information private, both during and after the relationship.

## 6. Limitation of Liability
Provider's total liability under this MSA and any SOW is limited to the fees paid under the relevant SOW in the [12 months] preceding the claim.

## 7. Term and Termination
This MSA remains in effect until terminated by either party with [Notice Period] written notice, though active SOWs continue under their own terms unless also terminated.

## 8. Governing Law
This Agreement is governed by the laws of [State/Country].

---
Provider: ______________________  Date: ____________
Client: ______________________  Date: ____________

*This document is provided for informational and educational purposes only and does not constitute legal advice. An MSA + SOW structure is most useful once you expect multiple projects with the same client — for a single one-off project, a single combined agreement is usually simpler.*`,
  },
  {
    slug: "retainer-agreement-template",
    name: "Retainer Agreement",
    seoTitle: "Free Retainer Agreement Template",
    description: "Free retainer agreement template for an ongoing arrangement where a client pays a recurring fee for a set amount of work or availability.",
    category: "Business",
    bodyMarkdown: `# Retainer Agreement

**Provider:** [Your Name/Company]
**Client:** [Client Name]
**Effective Date:** [Date]

## 1. Retainer
Client will pay Provider a retainer of [Amount] per [Month], in exchange for [Description — e.g. "up to 10 hours of work per month" or "priority availability and ongoing advisory services"].

## 2. Scope
[What is and isn't covered by the retainer — be specific about hour limits, response times, or included services.]

## 3. Overage
Work beyond the included scope is billed at [Rate], with Client's approval before starting.

## 4. Payment
The retainer is due [Timing — e.g. "on the 1st of each month, in advance"], regardless of whether the full included scope is used.

## 5. Unused Time
[State your policy clearly — e.g. "Unused hours do not roll over to the next month" or "Unused hours roll over for up to 30 days."]

## 6. Term and Termination
This Agreement continues month-to-month until either party gives [Notice Period] written notice.

---
Provider: ______________________  Date: ____________
Client: ______________________  Date: ____________

*Stating upfront whether unused retainer time rolls over (most don't) prevents an awkward conversation in month two when the client asks about "banking" hours they didn't use.*`,
  },
];

const TEMPLATES_INDEX_FAQ = [
  {
    q: "Are these invoice templates really free?",
    a: "Yes — all templates are free to view, copy, and edit with no account or signup required. docstoc never emails your clients for you; you copy the draft into your own inbox.",
  },
  {
    q: "Can I edit these templates?",
    a: "Yes. Copy the subject and body, then swap in your invoice number, amount, due date, and client name before sending from Gmail, Outlook, or Apple Mail.",
  },
  {
    q: "Which template should I use for an overdue invoice?",
    a: "Match the tone to how late it is: a gentle nudge at 1–3 days overdue, firmer at 7–14 days, and a formal notice from 30 days onward. Use the category filter above to jump straight to the right stage.",
  },
  {
    q: "Is there a way to get a version matched to my exact invoice?",
    a: "Yes — the free AI tool drafts a tone-matched follow-up from your actual invoice details (client, amount, due date) instead of a generic template.",
  },
];

const indexJsonLd = JSON.stringify(
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: "Free Invoice Payment Reminder Email Templates",
        url: "https://chasa.io/free-templates/",
        description:
          `${TEMPLATES.length} free, copy-paste payment reminder email templates for freelancers — from pre-due nudges to final notices.`,
        isPartOf: { "@type": "WebSite", name: "docstoc", url: "https://chasa.io" },
        mainEntity: {
          "@type": "ItemList",
          itemListElement: TEMPLATES.map((t, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `https://chasa.io/free-templates/${t.slug}`,
            name: t.name,
          })),
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: TEMPLATES_INDEX_FAQ.map((item) => ({
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

function slugifyCategory(name) {
  return "cat-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function templateCard(t) {
  const searchBlob = escapeHtml(`${t.name} ${t.description} ${t.stage} ${t.tone}`.toLowerCase());
  return `      <a class="tpl-card" href="/free-templates/${t.slug}" data-search="${searchBlob}">
        <div class="tpl-meta"><span>${escapeHtml(t.stage)}</span><span>${escapeHtml(t.tone)}</span></div>
        <h3>${escapeHtml(t.name)}</h3>
        <p>${escapeHtml(t.description)}</p>
      </a>`;
}

const categorySections = CATEGORIES.map((cat) => {
  const items = TEMPLATES.filter((t) => t.category === cat);
  if (!items.length) return "";
  return `  <section class="tpl-cat-section" id="${slugifyCategory(cat)}">
    <h2 class="tpl-cat-title">${escapeHtml(cat)}</h2>
    <div class="tpl-grid">
${items.map(templateCard).join("\n")}
    </div>
  </section>`;
}).join("\n");

const tplCount = TEMPLATES.length;
const tplCountWord =
  {
    15: "Fifteen",
    16: "Sixteen",
    17: "Seventeen",
    18: "Eighteen",
    19: "Nineteen",
    20: "Twenty",
  }[tplCount] ?? String(tplCount);

const indexHtml = chrome({
  title: `Free Invoice Payment Reminder Email Templates (${tplCount}) | docstoc`,
  description: `${tplCount} free payment reminder and overdue invoice email templates for freelancers. Copy, personalize, and send — or generate a tone-matched draft in docstoc.`,
  canonical: "https://chasa.io/free-templates/",
  activeNav: "templates",
  jsonLd: indexJsonLd,
  mainHtml: `<section class="tpl-hero">
  <div class="wrap tpl-hero-inner">
    <h1>Send payment reminders that actually get paid</h1>
    <p class="tpl-hero-lede">${tplCount} free, editable invoice templates and counting — chase overdue payments without the awkwardness.</p>
    <div class="tpl-hero-search">
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="9" cy="9" r="6.5" stroke="currentColor" stroke-width="1.6"/><path d="M14 14L18 18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
      <input type="search" id="tpl-search" placeholder="What template are you looking for?" autocomplete="off" aria-label="Search templates" />
    </div>
    <p style="font-size:12.5px;color:#8A8A8A;margin-top:10px;">Checked by chartered accountant <a href="https://www.xing.com/profile/Stephan_Orasch" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline;">Stephan Orasch</a>, Grohmann Hienert Zierhut.</p>
  </div>
</section>
<main class="wrap templates-index">
  <p class="crumb"><a href="/">Home</a> / Free templates</p>
  <div class="tpl-toolbar">
    <span class="tpl-toolbar-count" id="tpl-count">${tplCount} templates</span>
    <div class="tpl-cat-dropdown" id="tpl-cat-dropdown">
      <button type="button" class="tpl-cat-dropdown-btn" id="tpl-cat-btn" aria-haspopup="true" aria-expanded="false" aria-controls="tpl-cat-menu">
        Categories
        <svg class="tpl-cat-dropdown-chevron" viewBox="0 0 12 8" aria-hidden="true"><path d="M1 1l5 5 5-5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="tpl-cat-dropdown-menu" id="tpl-cat-menu" role="menu" aria-labelledby="tpl-cat-btn" hidden>
${CATEGORIES.map((c) => `        <a href="#${slugifyCategory(c)}" class="tpl-cat-dropdown-item" role="menuitem" data-cat-target="${slugifyCategory(c)}">${escapeHtml(c)}</a>`).join("\n")}
      </div>
    </div>
  </div>

  <aside class="tpl-pack-strip" aria-label="Download the full PDF pack">
    <p class="tpl-pack-strip-copy">Get all ${tplCount} politely worded invoice templates in one branded PDF</p>
    <a class="tpl-pack-strip-btn" href="/free-templates/download">Download</a>
  </aside>

  <p class="tpl-index-note" style="margin-top:8px">
    Got a template that's worked for you? <a href="/free-templates/submit">Submit it</a> — reviewed, then published free for everyone.
  </p>

  <p class="tpl-index-note">
    ${tplCountWord} copy-paste emails for every stage of getting paid — on send, before the due date through final notice,
    plus thank-yous, disputes, and multi-invoice summaries. Original docstoc wording; use as-is or let the
    <a href="/app/">AI tool</a> draft a version matched to how late the invoice is.
  </p>

  <div id="tpl-sections">
${categorySections}
  </div>
  <p class="tpl-no-results" id="tpl-no-results" hidden>No templates match &ldquo;<span id="tpl-no-results-q"></span>&rdquo;. <a href="/app/">Try the AI tool</a> instead?</p>

  <section class="tpl-cat-section" id="tpl-community" hidden>
    <h2 class="tpl-cat-title">Community templates</h2>
    <p class="tpl-index-note">Submitted by other docstoc users, reviewed before publishing. <a href="/free-templates/submit">Share your own</a>.</p>
    <div class="tpl-grid" id="tpl-community-grid"></div>
  </section>

  <h2 id="faq">FAQ</h2>
${TEMPLATES_INDEX_FAQ.map((item) => `  <details class="faq-item"><summary>${escapeHtml(item.q)}</summary>
  <p>${escapeHtml(item.a)}</p>
  </details>`).join("\n")}
</main>
<script>
(function () {
  var search = document.getElementById("tpl-search");
  var countEl = document.getElementById("tpl-count");
  var noResults = document.getElementById("tpl-no-results");
  var noResultsQ = document.getElementById("tpl-no-results-q");
  var cards = Array.prototype.slice.call(document.querySelectorAll(".tpl-card"));
  var sections = Array.prototype.slice.call(document.querySelectorAll(".tpl-cat-section"));

  function applyFilter() {
    var q = (search.value || "").trim().toLowerCase();
    var visible = 0;
    cards.forEach(function (card) {
      var text = card.getAttribute("data-search") || "";
      var match = !q || text.indexOf(q) !== -1;
      card.hidden = !match;
      if (match) visible++;
    });
    sections.forEach(function (section) {
      var anyVisible = section.querySelectorAll(".tpl-card:not([hidden])").length > 0;
      section.hidden = !anyVisible;
    });
    countEl.textContent = visible + (visible === 1 ? " template" : " templates");
    if (noResults) {
      noResults.hidden = visible !== 0;
      if (noResultsQ) noResultsQ.textContent = search ? search.value : "";
    }
  }

  if (search) search.addEventListener("input", applyFilter);

  var dropdown = document.getElementById("tpl-cat-dropdown");
  var catBtn = document.getElementById("tpl-cat-btn");
  var catMenu = document.getElementById("tpl-cat-menu");

  function closeCatMenu() {
    if (!dropdown || !dropdown.classList.contains("is-open")) return;
    dropdown.classList.remove("is-open");
    catBtn.setAttribute("aria-expanded", "false");
    // Wait for the CSS transition to finish before hiding, so the menu fades/slides out
    // instead of snapping away instantly.
    setTimeout(function () {
      if (!dropdown.classList.contains("is-open")) catMenu.hidden = true;
    }, 160);
  }

  function openCatMenu() {
    if (!dropdown) return;
    catMenu.hidden = false;
    // Force a layout flush between un-hiding and adding the class, so the browser registers the
    // pre-transition state before animating — requestAnimationFrame can get throttled/skipped
    // (backgrounded tab, some automation contexts), which would silently leave the menu at
    // opacity: 0 forever. Reading offsetHeight is synchronous and always works.
    void catMenu.offsetHeight;
    dropdown.classList.add("is-open");
    catBtn.setAttribute("aria-expanded", "true");
  }

  if (catBtn && catMenu) {
    catBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (dropdown.classList.contains("is-open")) closeCatMenu();
      else openCatMenu();
    });
    catMenu.addEventListener("click", function (e) {
      var item = e.target.closest("[data-cat-target]");
      if (!item) return;
      e.preventDefault();
      var el = document.getElementById(item.getAttribute("data-cat-target"));
      closeCatMenu();
      if (el) el.scrollIntoView({ behavior: "auto", block: "start" });
    });
    document.addEventListener("click", function (e) {
      if (dropdown.classList.contains("is-open") && !dropdown.contains(e.target)) closeCatMenu();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeCatMenu();
    });
  }

  // Community templates — approved user submissions, fetched live (not build-time static like the
  // rest of this page) since they can appear the moment an admin approves them.
  var communitySection = document.getElementById("tpl-community");
  var communityGrid = document.getElementById("tpl-community-grid");
  if (communitySection && communityGrid) {
    fetch("/api/marketplace?type=email")
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        var rows = (data && data.templates) || [];
        if (!rows.length) return;
        function esc(s) { return String(s || "").replace(/</g, "&lt;"); }
        rows.forEach(function (t) {
          var card = document.createElement("div");
          card.className = "tpl-card tpl-card-community";
          var meta = (t.stage || "") + (t.stage && t.tone ? " · " : "") + (t.tone || "");
          var featuredBadge = t.featured ? '<span class="tpl-featured-badge">Featured</span>' : "";
          var tagsHtml = (t.tags || []).length
            ? '<div class="tpl-tags">' + t.tags.map(function (tag) {
                return '<span class="tpl-tag">' + esc(tag) + "</span>";
              }).join("") + "</div>"
            : "";
          var authorHtml = "";
          if (t.submitterName) {
            authorHtml =
              '<p class="tpl-author">By ' +
              (t.submitterUrl && /^https?:\/\//i.test(t.submitterUrl)
                ? '<a href="' + esc(t.submitterUrl) + '" target="_blank" rel="noopener ugc">' + esc(t.submitterName) + "</a>"
                : esc(t.submitterName)) +
              "</p>";
          }
          card.innerHTML =
            '<div class="tpl-meta"><span>' + esc(meta) + "</span>" + featuredBadge + "</div>" +
            "<h3>" + esc(t.name) + "</h3>" +
            "<p>" + esc(t.description) + "</p>" +
            tagsHtml +
            authorHtml +
            '<button type="button" class="btn-copy" data-subject="' + encodeURIComponent(t.subject || "") + '" data-body="' + encodeURIComponent(t.body || "") + '">Copy subject + body</button>';
          communityGrid.appendChild(card);
        });
        communitySection.hidden = false;
        // Reflect community submissions in the hero/toolbar count so "and counting" stays literal.
        var countEl2 = document.getElementById("tpl-count");
        if (countEl2) {
          var newTotal = ${tplCount} + rows.length;
          countEl2.textContent = newTotal + " templates";
        }
        communityGrid.querySelectorAll(".btn-copy").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var subject = decodeURIComponent(btn.getAttribute("data-subject"));
            var body = decodeURIComponent(btn.getAttribute("data-body"));
            navigator.clipboard.writeText("Subject: " + subject + "\\n\\n" + body).then(function () {
              btn.textContent = "Copied";
              setTimeout(function () {
                btn.textContent = "Copy subject + body";
              }, 1500);
            });
          });
        });
      })
      .catch(function () {});
  }
})();
</script>`,
});

writeFileSync(join(outDir, "index.html"), indexHtml);

const downloadJsonLd = JSON.stringify(
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `Download ${tplCount} polite invoice templates — docstoc`,
    description: `Free PDF pack of ${tplCount} politely worded payment reminder emails. Enter your details to download.`,
    url: "https://chasa.io/free-templates/download",
    isPartOf: { "@type": "WebSite", name: "docstoc", url: "https://chasa.io" },
  },
  null,
  2
);

const downloadHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Download ${tplCount} polite invoice templates — docstoc</title>
<meta name="description" content="Free PDF pack of ${tplCount} politely worded payment reminder emails for freelancers and small teams. Download with the docstoc logo.">
<link rel="canonical" href="https://chasa.io/free-templates/download">
<meta property="og:type" content="website">
<meta property="og:title" content="Download ${tplCount} polite invoice templates — docstoc">
<meta property="og:description" content="Free PDF pack of ${tplCount} politely worded payment reminder emails. Enter your details to download.">
<meta property="og:url" content="https://chasa.io/free-templates/download">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="Download ${tplCount} polite invoice templates — docstoc">
<meta name="twitter:description" content="Free PDF pack of ${tplCount} politely worded payment reminder emails. Enter your details to download.">
<script type="application/ld+json">
${downloadJsonLd}
</script>
<link rel="icon" href="/favicon.png" type="image/png">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="/site.css?v=${ASSET_V}">
</head>
<body class="lead-pack-page">
  <header class="lead-pack-topbar">
    <a href="/" class="lead-pack-brand" aria-label="docstoc home">
      <img src="/brand/docstoc-icon.png" alt="" width="28" height="28" />
      <span>chasa</span>
    </a>
    <a href="/free-templates/" class="lead-pack-top-link">Browse templates</a>
  </header>

  <main class="lead-pack-shell">
    <section class="lead-pack-copy">
      <h1>${tplCount} politely worded templates to get invoices paid</h1>
      <p>
        Tired of rewriting the same chase email — or sounding too harsh when cash is late?
        Freelancers and small teams lose days to awkward follow-ups and inconsistent tone.
      </p>
      <p>
        This free PDF packs every docstoc template into one branded guide: subjects, bodies, and stage notes
        from sending the invoice through final notice, thank-yous, disputes, and multi-invoice summaries.
      </p>
      <div class="lead-pack-mock" aria-hidden="true">
        <div class="lead-pack-book lead-pack-book-back"></div>
        <div class="lead-pack-book lead-pack-book-mid"></div>
        <div class="lead-pack-book lead-pack-book-front">
          <div class="lead-pack-book-mark">chasa</div>
          <div class="lead-pack-book-title">${tplCount} politely worded templates</div>
          <div class="lead-pack-book-sub">to get invoices paid</div>
          <ul class="lead-pack-book-bullets">
            <li>Pre-due → final notice</li>
            <li>Disputes &amp; thank-yous</li>
            <li>Copy-paste ready</li>
          </ul>
        </div>
      </div>
    </section>

    <section class="lead-pack-card" aria-labelledby="lead-pack-form-title">
      <h2 id="lead-pack-form-title">Download your free guide</h2>
      <form id="templates-pack-form" class="lead-pack-form" novalidate>
        <label class="lead-pack-label" for="templates-pack-first-name">First name <span aria-hidden="true">*</span></label>
        <input id="templates-pack-first-name" name="firstName" type="text" autocomplete="given-name" required maxlength="80" />

        <label class="lead-pack-label" for="templates-pack-email">Email <span aria-hidden="true">*</span></label>
        <input id="templates-pack-email" name="email" type="email" autocomplete="email" required maxlength="254" placeholder="you@studio.com" />

        <label class="lead-pack-label" for="templates-pack-role">How do you chase invoices?</label>
        <select id="templates-pack-role" name="role">
          <option value="">Please select</option>
          <option value="freelancer">Freelancer / solo</option>
          <option value="agency">Small agency or studio</option>
          <option value="inhouse">In-house ops / finance</option>
          <option value="accounting">Accounting or bookkeeping firm</option>
          <option value="other">Other</option>
        </select>

        <label class="lead-pack-label" for="templates-pack-tool">Which invoicing setup do you use? <span aria-hidden="true">*</span></label>
        <select id="templates-pack-tool" name="invoiceTool" required>
          <option value="">Please select</option>
          <option value="spreadsheet">Spreadsheet / CSV</option>
          <option value="quickbooks">QuickBooks</option>
          <option value="xero">Xero</option>
          <option value="wave">Wave / FreshBooks / similar</option>
          <option value="other">Other / not sure</option>
        </select>

        <div id="templates-pack-turnstile" class="tpl-pack-turnstile"></div>
        <p id="templates-pack-status" class="tpl-pack-status" role="status" aria-live="polite"></p>

        <p class="lead-pack-fine">
          docstoc will use the contact information you provide to send the PDF and occasional product tips.
          You can unsubscribe anytime. See our <a href="/privacy">Privacy Policy</a>.
        </p>

        <button type="submit" class="lead-pack-submit" id="templates-pack-submit">Download now</button>
      </form>
    </section>
  </main>

  <p class="lead-pack-foot">
    Prefer browsing online? <a href="/free-templates/">All ${tplCount} templates stay free</a> — no email required.
  </p>
  <script src="/templates-pack.js?v=${ASSET_V}" defer></script>
  <script src="/site-nav.js?v=${ASSET_V}" defer></script>
</body>
</html>
`;

writeFileSync(join(outDir, "download.html"), downloadHtml);
console.log(`Wrote download landing → ${join(outDir, "download.html")}`);

const submitJsonLd = JSON.stringify(
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Submit your own invoice follow-up template — docstoc",
    description:
      "Share a payment reminder or invoice follow-up email that's worked for you. Reviewed by docstoc, then published free for everyone.",
    url: "https://chasa.io/free-templates/submit",
    isPartOf: { "@type": "WebSite", name: "docstoc", url: "https://chasa.io" },
  },
  null,
  2
);

const submitHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Submit Your Invoice Follow-Up Template — docstoc</title>
<meta name="description" content="Share a payment reminder or invoice follow-up email that's worked for you. Reviewed by docstoc, then published free on our template library.">
<link rel="canonical" href="https://chasa.io/free-templates/submit">
<meta property="og:type" content="website">
<meta property="og:title" content="Submit Your Invoice Follow-Up Template — docstoc">
<meta property="og:description" content="Share a payment reminder or invoice follow-up email that's worked for you. Reviewed by docstoc, then published free on our template library.">
<meta property="og:url" content="https://chasa.io/free-templates/submit">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="Submit Your Invoice Follow-Up Template — docstoc">
<meta name="twitter:description" content="Share a payment reminder or invoice follow-up email that's worked for you. Reviewed by docstoc, then published free on our template library.">
<script type="application/ld+json">
${submitJsonLd}
</script>
<link rel="icon" href="/favicon.png" type="image/png">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="/site.css?v=${ASSET_V}">
</head>
<body class="lead-pack-page">
  <header class="lead-pack-topbar">
    <a href="/" class="lead-pack-brand" aria-label="docstoc home">
      <img src="/brand/docstoc-icon.png" alt="" width="28" height="28" />
      <span>chasa</span>
    </a>
    <a href="/free-templates/" class="lead-pack-top-link">Browse templates</a>
  </header>

  <main class="lead-pack-shell">
    <section class="lead-pack-copy">
      <h1>Share a template that's worked for you</h1>
      <p>
        Every freelancer eventually writes a chase email that just works — the wording that gets a
        client to pay without the relationship turning awkward. Share yours here.
      </p>
      <p>
        No sign-in required. We review every submission before it goes live — nothing publishes
        automatically — and it'll sit alongside our own ${tplCount} templates at
        <a href="/free-templates/">/free-templates</a>, free for anyone to copy.
      </p>
    </section>

    <section class="lead-pack-card" aria-labelledby="mkt-form-title">
      <h2 id="mkt-form-title">Submit your template</h2>
      <form id="marketplace-submit-form" class="lead-pack-form" novalidate>
        <label class="lead-pack-label" for="mkt-name">Template name <span aria-hidden="true">*</span></label>
        <input id="mkt-name" name="name" type="text" required maxlength="100" placeholder="e.g. Friendly nudge for repeat clients" />

        <label class="lead-pack-label" for="mkt-description">Short description</label>
        <input id="mkt-description" name="description" type="text" maxlength="400" placeholder="When would someone use this?" />

        <label class="lead-pack-label" for="mkt-category">Category</label>
        <select id="mkt-category" name="category">
          <option value="">Please select</option>
${CATEGORIES.map((c) => `          <option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("\n")}
        </select>

        <label class="lead-pack-label" for="mkt-stage">Stage (how overdue is it?)</label>
        <input id="mkt-stage" name="stage" type="text" maxlength="60" placeholder="e.g. 14 days overdue" />

        <label class="lead-pack-label" for="mkt-tone">Tone</label>
        <input id="mkt-tone" name="tone" type="text" maxlength="40" placeholder="e.g. Firm, Friendly, Warm" />

        <label class="lead-pack-label" for="mkt-subject">Email subject <span aria-hidden="true">*</span></label>
        <input id="mkt-subject" name="subject" type="text" required maxlength="200" placeholder="Invoice [Invoice #] — following up" />

        <label class="lead-pack-label" for="mkt-body">Email body <span aria-hidden="true">*</span></label>
        <textarea id="mkt-body" name="body" required maxlength="4000" rows="10" placeholder="Hi [Client name], ..."></textarea>

        <label class="lead-pack-label" for="mkt-tags">Tags (comma-separated, up to 10)</label>
        <input id="mkt-tags" name="tags" type="text" maxlength="300" placeholder="overdue invoice, freelancer, firm email" />

        <label class="lead-pack-label" for="mkt-author-name">Your name (optional — credited on the template)</label>
        <input id="mkt-author-name" name="submitterName" type="text" maxlength="80" placeholder="Shown as the template's author" />

        <label class="lead-pack-label" for="mkt-author-url">Your website (optional — linked from the template)</label>
        <input id="mkt-author-url" name="submitterUrl" type="url" maxlength="300" placeholder="https://your-site.com" />

        <label class="lead-pack-label" for="mkt-email">Your email (optional, kept private)</label>
        <input id="mkt-email" name="submitterEmail" type="email" maxlength="254" placeholder="Only if you want us to follow up with you" />

        <div id="mkt-turnstile" class="tpl-pack-turnstile"></div>
        <p id="mkt-status" class="tpl-pack-status" role="status" aria-live="polite"></p>

        <p class="lead-pack-fine">
          Use placeholders like [Client name], [Invoice #], and [Amount] instead of real client details.
          We review every submission and may lightly edit wording before publishing. See our
          <a href="/privacy">Privacy Policy</a>.
        </p>

        <button type="submit" class="lead-pack-submit" id="mkt-submit">Submit template</button>
      </form>

      <div id="mkt-done" class="lead-pack-fine" hidden>
        <p><strong>Thanks — your template is in for review.</strong> If it's approved, it'll show up at
        <a href="/free-templates/">/free-templates/</a> soon.</p>
      </div>
    </section>
  </main>

  <p class="lead-pack-foot">
    Just want to browse? <a href="/free-templates/">See all ${tplCount} templates</a> — no email required.
  </p>
  <script src="/marketplace-submit.js?v=${ASSET_V}" defer></script>
  <script src="/site-nav.js?v=${ASSET_V}" defer></script>
</body>
</html>
`;

writeFileSync(join(outDir, "submit.html"), submitHtml);
console.log(`Wrote submit-a-template landing → ${join(outDir, "submit.html")}`);

/** Shareable announcement page for a batch of new templates — built for social (X/Facebook/
 *  LinkedIn) posts, so it needs strong OG/Twitter meta and to work as a single link with no
 *  context needed. Update NEW_BATCH_SLUGS when a future batch ships; older batches stay live at
 *  their own URL, they just stop being "the" announcement page. */
const NEW_BATCH_SLUGS = [
  "freelancer-polite-payment-reminder",
  "freelancer-firm-payment-reminder",
  "freelancer-30-days-overdue-reminder",
  "agency-retainer-invoice-follow-up",
  "agency-milestone-invoice-follow-up",
  "agency-final-invoice-follow-up",
  "corporate-overdue-invoice-escalation",
  "corporate-finance-department-reminder",
  "final-notice-before-legal-action",
  "client-ghosted-me-template",
];
const newBatch = NEW_BATCH_SLUGS.map((slug) => TEMPLATES.find((t) => t.slug === slug)).filter(Boolean);

const newTemplatesJsonLd = JSON.stringify(
  {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "10 new free invoice follow-up templates — docstoc",
    description: `${newBatch.length} new templates for freelancers, agencies, and corporate finance teams, plus a legal-tone final notice and a template for when a client goes silent.`,
    url: "https://chasa.io/free-templates/new",
    numberOfItems: newBatch.length,
    itemListElement: newBatch.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `https://chasa.io/free-templates/${t.slug}`,
      name: t.name,
    })),
  },
  null,
  2
);

const newBatchCards = newBatch
  .map(
    (t) => `        <a class="tpl-card" href="/free-templates/${t.slug}">
          <div class="tpl-meta"><span>${escapeHtml(t.stage)}</span><span>${escapeHtml(t.tone)}</span></div>
          <h3>${escapeHtml(t.name)}</h3>
          <p>${escapeHtml(t.description)}</p>
        </a>`
  )
  .join("\n");

const newTemplatesHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>10 New Free Invoice Follow-Up Templates | docstoc</title>
<meta name="description" content="10 new free invoice follow-up templates for freelancers, agencies, and corporate finance teams — plus a legal-tone final notice and a template for when a client goes silent. Now ${tplCount} templates and counting.">
<link rel="canonical" href="https://chasa.io/free-templates/new">
<meta property="og:type" content="website">
<meta property="og:title" content="10 New Free Invoice Follow-Up Templates">
<meta property="og:description" content="Freelancer, agency, and corporate invoice follow-up templates — plus a legal-tone final notice and a template for when a client goes silent. Free, copy-paste ready.">
<meta property="og:url" content="https://chasa.io/free-templates/new">
<meta property="og:image" content="https://chasa.io/brand/og/docstoc-og-1200x630.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="10 New Free Invoice Follow-Up Templates">
<meta name="twitter:description" content="Freelancer, agency, and corporate invoice follow-up templates — plus a legal-tone final notice and a template for when a client goes silent. Free, copy-paste ready.">
<meta name="twitter:image" content="https://chasa.io/brand/og/docstoc-og-1200x630.png">
<script type="application/ld+json">
${newTemplatesJsonLd}
</script>
<link rel="icon" href="/favicon.png" type="image/png">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="/site.css?v=${ASSET_V}">
</head>
<body class="lead-pack-page">
  <header class="lead-pack-topbar">
    <a href="/" class="lead-pack-brand" aria-label="docstoc home">
      <img src="/brand/docstoc-icon.png" alt="" width="28" height="28" />
      <span>chasa</span>
    </a>
    <a href="/free-templates/" class="lead-pack-top-link">Browse all ${tplCount} templates</a>
  </header>

  <main class="wrap templates-index" style="padding-top:32px">
    <p class="crumb"><a href="/">Home</a> / <a href="/free-templates/">Free templates</a> / New</p>
    <h1>10 new invoice follow-up templates just dropped</h1>
    <p class="tpl-hero-lede">
      Freelancer, agency, and corporate versions of the reminder you're already sending — plus a legal-tone
      final notice and the one every freelancer eventually needs: what to send when a client just goes quiet.
    </p>
    <p class="tpl-toolbar-count" style="display:inline-block;margin:8px 0 24px;">${tplCount} templates and counting</p>

    <div class="tpl-grid">
${newBatchCards}
    </div>

    <p class="tpl-index-note" style="margin-top:32px">
      Have one that's worked for you? <a href="/free-templates/submit">Submit it</a> — reviewed, then published
      free for everyone, same as these. Or <a href="/free-templates/">browse the full library</a>.
    </p>
  </main>

  <script src="/site-nav.js?v=${ASSET_V}" defer></script>
</body>
</html>
`;

writeFileSync(join(outDir, "new.html"), newTemplatesHtml);
console.log(`Wrote new-templates announcement page → ${join(outDir, "new.html")}`);

/** Real placeholders pulled straight from the template body (e.g. "[Client name]") — used in the
 *  "What's included" list so that section reflects the actual template instead of generic filler. */
function extractPlaceholders(body) {
  const seen = new Set();
  const out = [];
  for (const m of body.matchAll(/\[([^\]]+)\]/g)) {
    const label = m[1].trim();
    if (!seen.has(label.toLowerCase())) {
      seen.add(label.toLowerCase());
      out.push(label);
    }
  }
  return out;
}

/** Category-specific framing for the SEO intro + use cases — this is what keeps 29 pages from
 *  reading like the same paragraph with the name swapped. */
const CATEGORY_FRAMING = {
  Freelancer: {
    audience: "freelancers and solo consultants",
    problem: "chasing a client for payment yourself, with no accounts-receivable team to lean on",
    useCase4: { title: "First-time late payers", desc: "A regular client who's always paid on time but has gone quiet this once." },
  },
  Agency: {
    audience: "agencies and small studios",
    problem: "following up on retainers or project invoices without sounding like a collections agency",
    useCase4: { title: "Retainer & milestone billing", desc: "Recurring or project-based invoices where the relationship needs to keep working." },
  },
  Corporate: {
    audience: "vendors and finance teams billing larger companies",
    problem: "getting a response from an accounts-payable department instead of one direct contact",
    useCase4: { title: "Enterprise AP departments", desc: "Invoices routed through a formal approval process with PO numbers and vendor IDs." },
  },
  Legal: {
    audience: "freelancers and small businesses at the end of the road with a client",
    problem: "needing a clear, professional paper trail before considering further action",
    useCase4: { title: "Before escalation", desc: "Documenting a final, serious attempt to resolve payment directly." },
  },
  "Ghosted client": {
    audience: "freelancers dealing with a client who's stopped responding",
    problem: "figuring out what to say when someone who used to reply promptly goes silent",
    useCase4: { title: "Client went quiet", desc: "No response to invoices or messages — you need to know where you stand." },
  },
  "Before due": {
    audience: "freelancers and small teams who invoice regularly",
    problem: "reminding a client an invoice is coming due without sounding like a nag",
    useCase4: { title: "Recurring clients", desc: "Regular billing where a quick heads-up keeps payments on schedule." },
  },
  "Due & early overdue": {
    audience: "freelancers and small businesses",
    problem: "sending that first nudge after an invoice is missed, before it becomes a real problem",
    useCase4: { title: "One-off projects", desc: "A single invoice that just needs a gentle, well-timed reminder." },
  },
  "Overdue follow-ups": {
    audience: "freelancers and small teams",
    problem: "following up again after a first reminder went unanswered, without escalating too fast",
    useCase4: { title: "Repeat follow-ups", desc: "When a polite first nudge didn't get a response and it's time to be clearer." },
  },
  "Formal notices": {
    audience: "freelancers and small businesses with a seriously overdue invoice",
    problem: "putting a firm, professional notice in writing once informal reminders haven't worked",
    useCase4: { title: "Long-overdue invoices", desc: "Invoices 30+ days late where the tone needs to shift from reminder to notice." },
  },
  Disputes: {
    audience: "freelancers and agencies",
    problem: "responding to pushback on an invoice without the conversation turning adversarial",
    useCase4: { title: "Invoice disputes", desc: "A client questions the amount, scope, or an invoice they say they never received." },
  },
  "Payments received": {
    audience: "freelancers and small businesses",
    problem: "closing the loop professionally once a client actually pays",
    useCase4: { title: "Confirming payment", desc: "Acknowledging a payment so the client knows the account is settled." },
  },
};

const SHARED_USE_CASES = [
  { title: "Freelancers & solo consultants", desc: "Chasing payment yourself, directly from your own inbox, with no AR team behind you." },
  { title: "Agencies & small teams", desc: "Following up on client invoices without it falling on one overworked person." },
  { title: "Growing businesses", desc: "Managing follow-ups across multiple clients and payment stages without losing track." },
];

function buildSeoIntro(t) {
  const framing = CATEGORY_FRAMING[t.category] || CATEGORY_FRAMING["Overdue follow-ups"];
  return `Getting paid on time is hard enough without also having to write the follow-up email yourself. This free ${t.name.toLowerCase()} template is built specifically for ${framing.audience} ${framing.problem}. Instead of starting from a blank page or reusing a generic payment reminder email that doesn't quite match how late the invoice is, you get a ${t.tone.toLowerCase()}-toned, ready-to-send draft matched to this exact stage: ${t.stage.toLowerCase()}. Copy the subject and body as-is, swap in your invoice details, and send it from Gmail, Outlook, or Apple Mail — no account, no signup, and no software to install. It's one of 28 free invoice follow-up templates and payment reminder emails on docstoc, covering everything from a friendly nudge before an invoice is even due through a formal final notice. If you'd rather have the wording generated fresh for your exact invoice, amount, and client, docstoc's AI tool drafts that automatically — this template stays free either way, with or without an account.`;
}

function buildWhatsIncluded(t) {
  const placeholders = extractPlaceholders(t.body);
  const items = [
    `A complete subject line, pre-written: "${t.subject}"`,
    `Full email body matched to "${t.stage}"`,
    `${t.tone} tone, calibrated for this exact situation — not one-size-fits-all`,
    placeholders.length
      ? `Placeholder fields for quick personalizing: ${placeholders.map((p) => `[${p}]`).join(", ")}`
      : `Placeholder fields for quick personalizing (client name, invoice number, amount)`,
    "Free to copy and use — no account or signup required",
    "Works with any invoicing tool, spreadsheet, or none at all",
    "Fully editable — adjust the wording to match your own voice",
    "Part of a 28-template library covering every stage from before-due to final notice",
  ];
  return items;
}

function buildUseCases(t) {
  const framing = CATEGORY_FRAMING[t.category] || CATEGORY_FRAMING["Overdue follow-ups"];
  return [...SHARED_USE_CASES, framing.useCase4];
}

function buildTemplateFaq(t) {
  const faq = [
    {
      q: `Is this ${t.name.toLowerCase()} template really free?`,
      a: `Yes — every template in docstoc's library is free to view, copy, and edit with no account or signup required. docstoc never emails your clients on your behalf; you copy this draft into your own inbox and send it yourself, so there's nothing to sign up for just to use the wording.`,
    },
    {
      q: "Can I edit the wording to match my own voice?",
      a: `Absolutely. Copy the subject and body, then adjust the tone, swap in your invoice details, or rewrite any part of it — it's a starting point, not a rigid script. The placeholders like [Client name] and [Invoice #] make it quick to personalize before sending.`,
    },
    {
      q: `When should I actually send this — is "${t.stage}" the right moment?`,
      a: `This template is written for invoices at the "${t.stage}" stage specifically. Sending the right tone at the right time matters — too firm too early can feel aggressive, too soft too late can read as not serious. If your situation doesn't quite match, browse the full library for the closest stage.`,
    },
    {
      q: "Does docstoc's AI tool improve on this template?",
      a: "Yes. This page gives you the wording for free with no signup. docstoc's AI tool goes further on Solo and Pro plans — it drafts a version matched to your exact invoice amount, client name, and how many days overdue it is, and can soften, firm up, or shorten a draft on request.",
    },
    {
      q: "What if the client still doesn't pay after I send this?",
      a: "If this reminder doesn't get a response, the next step is usually a firmer follow-up or a formal notice, depending on how late the invoice becomes. docstoc's free library includes templates for every stage, from a gentle first nudge through a final notice before collections.",
    },
  ];
  return faq;
}

/** Category-specific framing for document template pages — mirrors CATEGORY_FRAMING's role for
 *  chase emails, but with document/legal-document audience and use cases instead of invoicing. */
const DOCUMENT_CATEGORY_FRAMING = {
  Business: {
    audience: "founders, freelancers, and small business owners",
    problem: "formalizing a business decision or agreement without paying a lawyer to draft it from scratch",
    useCase4: { title: "Early-stage businesses", desc: "Getting the basics documented before things get more complex." },
  },
  Legal: {
    audience: "individuals and small businesses handling a straightforward legal document themselves",
    problem: "needing a clear, professional document without commissioning custom legal drafting for a routine situation",
    useCase4: { title: "Before involving a lawyer", desc: "A solid starting draft to review with counsel, or to use directly for a low-stakes situation." },
  },
  "Real Estate": {
    audience: "landlords, tenants, and small property owners",
    problem: "documenting a lease or tenancy change clearly, without guessing at the right structure",
    useCase4: { title: "Independent landlords", desc: "Managing a rental directly, without a property management company's paperwork." },
  },
  Finance: {
    audience: "small businesses and individuals documenting a loan or expense",
    problem: "putting financial terms in writing so both sides have a clear, shared record",
    useCase4: { title: "Informal lending & reimbursements", desc: "Money changing hands between people or a business and its team, without a bank's paperwork." },
  },
  HR: {
    audience: "small business owners and first-time managers",
    problem: "handling an HR moment professionally without a dedicated HR department to lean on",
    useCase4: { title: "Growing teams", desc: "Formalizing hiring and performance processes as a company adds its first employees." },
  },
};

const DOCUMENT_SHARED_USE_CASES = [
  { title: "Freelancers & solo founders", desc: "Handling routine business paperwork without commissioning custom legal drafting for every document." },
  { title: "Small businesses", desc: "Standardizing recurring documents — leases, agreements, notices — across a growing operation." },
  { title: "Anyone reviewing before signing", desc: "Using a clear starting structure to understand what a document should cover, even if a lawyer finalizes it." },
];

function buildDocumentSeoIntro(t) {
  const framing = DOCUMENT_CATEGORY_FRAMING[t.category] || DOCUMENT_CATEGORY_FRAMING.Business;
  return `Drafting a ${t.name.toLowerCase()} from scratch is slow, and generic templates often miss the sections that actually matter. This free template is built for ${framing.audience} ${framing.problem}. It's structured with the standard sections a document like this needs, with clearly marked [placeholder] fields so you can fill in your own details quickly. Copy it into your own word processor, fill in the placeholders, and review it — or adapt it — before use. It's part of docstoc's free document template library, alongside business, legal, real estate, finance, and HR templates. Every template here is free to copy with no signup required, and each one carries a plain disclaimer: this is a starting point for informational purposes, not a substitute for advice from a licensed professional in your jurisdiction.`;
}

function buildDocumentWhatsIncluded(t) {
  return [
    "A complete, ready-to-copy document structure with all standard sections",
    "Clearly marked [placeholder] fields for quick personalizing",
    "Free to copy and use — no account or signup required",
    "Plain-language sections instead of dense legal boilerplate",
    "Fully editable — adjust any clause to match your actual situation",
    "A clear disclaimer noting this is not legal or tax advice",
  ];
}

function buildDocumentUseCases(t) {
  const framing = DOCUMENT_CATEGORY_FRAMING[t.category] || DOCUMENT_CATEGORY_FRAMING.Business;
  return [...DOCUMENT_SHARED_USE_CASES, framing.useCase4];
}

function buildDocumentFaq(t) {
  return [
    {
      q: `Is this ${t.name.toLowerCase()} template really free?`,
      a: "Yes — every document template on this page is free to view, copy, and edit with no account or signup required.",
    },
    {
      q: "Is this legal advice?",
      a: "No. This template is provided for informational and educational purposes only. Laws and requirements vary by state, country, and situation — review any document with a licensed attorney (or relevant professional) before relying on it for something important.",
    },
    {
      q: "Can I edit the wording?",
      a: "Yes — copy the template and adjust any section, clause, or placeholder to fit your actual situation. It's a starting structure, not a rigid script.",
    },
    {
      q: "What do the [bracketed] placeholders mean?",
      a: "Each [placeholder] marks a spot to fill in your own details — names, dates, amounts, or terms specific to your situation. Replace every bracketed field before using the document.",
    },
    {
      q: "Where can I find more free templates like this?",
      a: "This template is part of a growing library of free business, legal, real estate, finance, and HR document templates — browse the full collection for related documents.",
    },
  ];
}

for (const t of DOCUMENT_TEMPLATES) {
  const faq = buildDocumentFaq(t);
  const jsonLd = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Article",
          headline: t.seoTitle,
          description: t.description,
          url: `https://chasa.io/document-templates/${t.slug}`,
          author: { "@type": "Organization", name: "docstoc" },
          publisher: { "@type": "Organization", name: "RELACON GmbH" },
          mainEntityOfPage: `https://chasa.io/document-templates/${t.slug}`,
        },
        {
          "@type": "FAQPage",
          mainEntity: faq.map((item) => ({
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

  const others = DOCUMENT_TEMPLATES.filter((x) => x.slug !== t.slug)
    .slice(0, 5)
    .map((x) => `<li><a href="/document-templates/${x.slug}">${escapeHtml(x.name)}</a></li>`)
    .join("\n");

  const whatsIncluded = buildDocumentWhatsIncluded(t)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("\n        ");

  const useCases = buildDocumentUseCases(t)
    .map(
      (uc) => `<div class="tpl-usecase">
          <h3>${escapeHtml(uc.title)}</h3>
          <p>${escapeHtml(uc.desc)}</p>
        </div>`
    )
    .join("\n        ");

  const faqHtml = faq
    .map(
      (item) =>
        `<details class="faq-item"><summary>${escapeHtml(item.q)}</summary>\n<p>${escapeHtml(item.a)}</p>\n</details>`
    )
    .join("\n      ");

  // Minimal Markdown-to-HTML: headings, bold, tables, hr, and paragraphs — enough for these
  // templates' structure without adding a Markdown dependency to the build.
  const bodyHtml = markdownToHtml(t.bodyMarkdown);

  const page = chrome({
    title: `${t.seoTitle} | docstoc`,
    description: t.description,
    canonical: `https://chasa.io/document-templates/${t.slug}`,
    activeNav: "templates",
    jsonLd,
    mainHtml: `<main class="wrap template-detail">
  <p class="crumb"><a href="/">Home</a> / <a href="/document-templates/">Document templates</a> / ${escapeHtml(t.name)}</p>
  <div class="tpl-meta"><span>${escapeHtml(t.category)}</span></div>
  <h1>${escapeHtml(t.name)}</h1>
  <p class="lede">${escapeHtml(t.description)}</p>
  <div class="tpl-hero-cta">
    <a class="nav-cta" href="/app/certificates">Certify a document you draft →</a>
  </div>
  ${trustBadgesHtml()}

  <p class="tpl-seo-intro">${buildDocumentSeoIntro(t)}</p>

  <div class="tpl-box">
    <div class="tpl-label">Template</div>
    <div class="tpl-doc-body">${bodyHtml}</div>
    <button type="button" class="btn-copy" data-copy="${encodeURIComponent(t.bodyMarkdown)}">Copy template</button>
  </div>

  <h2>What's included</h2>
  <ul class="tpl-included">
        ${whatsIncluded}
  </ul>

  <h2>Who this template is for</h2>
  <div class="tpl-usecases">
        ${useCases}
  </div>

  <h2>FAQ</h2>
  ${faqHtml}

  <h2>More free document templates</h2>
  <ul class="tpl-more">${others}
  </ul>

  ${conversionSectionHtml()}

  <div class="tpl-cta-footer">
    <h2>Add tamper-evident proof once you've filled this in</h2>
    <p>Hash your finished document for free and get a shareable link anyone can use to confirm it hasn't been altered.</p>
    <a class="nav-cta" href="/app/certificates">Create a free certificate</a>
  </div>
</main>
<script>
document.querySelectorAll(".btn-copy").forEach(function (btn) {
  btn.addEventListener("click", function () {
    var text = decodeURIComponent(btn.getAttribute("data-copy"));
    navigator.clipboard.writeText(text).then(function () {
      btn.textContent = "Copied";
      setTimeout(function () { btn.textContent = "Copy template"; }, 1500);
    });
  });
});
</script>`,
  });

  writeFileSync(join(docOutDir, `${t.slug}.html`), page);
}

writeFileSync(join(docOutDir, "templates.json"), JSON.stringify(DOCUMENT_TEMPLATES, null, 2));

function docTemplateCard(t) {
  const searchBlob = escapeHtml(`${t.name} ${t.description} ${t.category}`.toLowerCase());
  return `      <a class="tpl-card" href="/document-templates/${t.slug}" data-search="${searchBlob}">
        <div class="tpl-meta"><span>${escapeHtml(t.category)}</span></div>
        <h3>${escapeHtml(t.name)}</h3>
        <p>${escapeHtml(t.description)}</p>
      </a>`;
}

const docCategorySections = DOCUMENT_CATEGORIES.map((cat) => {
  const items = DOCUMENT_TEMPLATES.filter((t) => t.category === cat);
  if (!items.length) return "";
  return `  <section class="tpl-cat-section" id="${slugifyCategory(cat)}">
    <h2 class="tpl-cat-title">${escapeHtml(cat)}</h2>
    <div class="tpl-grid">
${items.map(docTemplateCard).join("\n")}
    </div>
  </section>`;
}).join("\n");

const DOC_INDEX_FAQ = [
  {
    q: "Are these document templates really free?",
    a: "Yes — every document template here is free to view, copy, and edit with no account or signup required.",
  },
  {
    q: "Is this legal advice?",
    a: "No. These templates are provided for informational and educational purposes only and are not a substitute for advice from a licensed attorney or other professional in your jurisdiction.",
  },
  {
    q: "Can I add my own document to this library?",
    a: "Yes — submit a template for review, including from a lawyer or accountant, and it can be published with a verified-expert credential once approved.",
  },
  {
    q: "How is this different from docstoc's invoice email templates?",
    a: "The free invoice templates are short chase-email copy for following up on unpaid invoices. These document templates are longer-form business, legal, real estate, finance, and HR documents — contracts, agreements, and notices, not emails.",
  },
];

const docIndexJsonLd = JSON.stringify(
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: "Free Business & Legal Document Templates",
        url: "https://chasa.io/document-templates/",
        description: `${DOCUMENT_TEMPLATES.length} free business, legal, real estate, finance, and HR document templates.`,
        isPartOf: { "@type": "WebSite", name: "docstoc", url: "https://chasa.io" },
        mainEntity: {
          "@type": "ItemList",
          itemListElement: DOCUMENT_TEMPLATES.map((t, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `https://chasa.io/document-templates/${t.slug}`,
            name: t.name,
          })),
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: DOC_INDEX_FAQ.map((item) => ({
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

const docIndexHtml = chrome({
  title: `Free Business & Legal Document Templates (${DOCUMENT_TEMPLATES.length}) | docstoc`,
  description: `${DOCUMENT_TEMPLATES.length} free business, legal, real estate, finance, and HR document templates. Copy, personalize, and certify — no signup required.`,
  canonical: "https://chasa.io/document-templates/",
  activeNav: "templates",
  jsonLd: docIndexJsonLd,
  mainHtml: `<section class="tpl-hero">
  <div class="wrap tpl-hero-inner">
    <h1>Free business & legal document templates</h1>
    <p class="tpl-hero-lede">${DOCUMENT_TEMPLATES.length} free, editable templates across business, legal, real estate, finance, and HR — copy, fill in, and certify.</p>
    <div class="tpl-hero-search">
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="9" cy="9" r="6.5" stroke="currentColor" stroke-width="1.6"/><path d="M14 14L18 18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
      <input type="search" id="tpl-search" placeholder="What document are you looking for?" autocomplete="off" aria-label="Search document templates" />
    </div>
  </div>
</section>
<main class="wrap templates-index">
  <p class="crumb"><a href="/">Home</a> / Document templates</p>
  <div class="tpl-toolbar">
    <span class="tpl-toolbar-count" id="tpl-count">${DOCUMENT_TEMPLATES.length} templates</span>
    <div class="tpl-cat-dropdown" id="tpl-cat-dropdown">
      <button type="button" class="tpl-cat-dropdown-btn" id="tpl-cat-btn" aria-haspopup="true" aria-expanded="false" aria-controls="tpl-cat-menu">
        Categories
        <svg class="tpl-cat-dropdown-chevron" viewBox="0 0 12 8" aria-hidden="true"><path d="M1 1l5 5 5-5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="tpl-cat-dropdown-menu" id="tpl-cat-menu" role="menu" aria-labelledby="tpl-cat-btn" hidden>
${DOCUMENT_CATEGORIES.map((c) => `        <a href="#${slugifyCategory(c)}" class="tpl-cat-dropdown-item" role="menuitem" data-cat-target="${slugifyCategory(c)}">${escapeHtml(c)}</a>`).join("\n")}
      </div>
    </div>
  </div>

  <p class="tpl-index-note" style="margin-top:8px">
    Have a template that's helped you? <a href="/free-templates/submit">Submit it</a> for review — lawyers and accountants can be published with a verified-expert credential.
  </p>

  <div id="tpl-sections">
${docCategorySections}
  </div>
  <p class="tpl-no-results" id="tpl-no-results" hidden>No templates match &ldquo;<span id="tpl-no-results-q"></span>&rdquo;.</p>

  <section class="tpl-cat-section" id="tpl-community" hidden>
    <h2 class="tpl-cat-title">Community templates</h2>
    <p class="tpl-index-note">Submitted by other docstoc users, reviewed before publishing.</p>
    <div class="tpl-grid" id="tpl-community-grid"></div>
  </section>

  <h2 id="faq">FAQ</h2>
${DOC_INDEX_FAQ.map((item) => `  <details class="faq-item"><summary>${escapeHtml(item.q)}</summary>
  <p>${escapeHtml(item.a)}</p>
  </details>`).join("\n")}
</main>
<script>
(function () {
  var search = document.getElementById("tpl-search");
  var countEl = document.getElementById("tpl-count");
  var noResults = document.getElementById("tpl-no-results");
  var noResultsQ = document.getElementById("tpl-no-results-q");
  var cards = Array.prototype.slice.call(document.querySelectorAll(".tpl-card"));
  var sections = Array.prototype.slice.call(document.querySelectorAll(".tpl-cat-section"));

  function applyFilter() {
    var q = (search.value || "").trim().toLowerCase();
    var visible = 0;
    cards.forEach(function (card) {
      var text = card.getAttribute("data-search") || "";
      var match = !q || text.indexOf(q) !== -1;
      card.hidden = !match;
      if (match) visible++;
    });
    sections.forEach(function (section) {
      var anyVisible = section.querySelectorAll(".tpl-card:not([hidden])").length > 0;
      section.hidden = !anyVisible;
    });
    countEl.textContent = visible + (visible === 1 ? " template" : " templates");
    if (noResults) {
      noResults.hidden = visible !== 0;
      if (noResultsQ) noResultsQ.textContent = search ? search.value : "";
    }
  }

  if (search) search.addEventListener("input", applyFilter);

  var dropdown = document.getElementById("tpl-cat-dropdown");
  var catBtn = document.getElementById("tpl-cat-btn");
  var catMenu = document.getElementById("tpl-cat-menu");

  function closeCatMenu() {
    if (!dropdown || !dropdown.classList.contains("is-open")) return;
    dropdown.classList.remove("is-open");
    catBtn.setAttribute("aria-expanded", "false");
    setTimeout(function () {
      if (!dropdown.classList.contains("is-open")) catMenu.hidden = true;
    }, 160);
  }

  function openCatMenu() {
    if (!dropdown) return;
    catMenu.hidden = false;
    void catMenu.offsetHeight;
    dropdown.classList.add("is-open");
    catBtn.setAttribute("aria-expanded", "true");
  }

  if (catBtn && catMenu) {
    catBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (dropdown.classList.contains("is-open")) closeCatMenu();
      else openCatMenu();
    });
    catMenu.addEventListener("click", function (e) {
      var item = e.target.closest("[data-cat-target]");
      if (!item) return;
      e.preventDefault();
      var el = document.getElementById(item.getAttribute("data-cat-target"));
      closeCatMenu();
      if (el) el.scrollIntoView({ behavior: "auto", block: "start" });
    });
    document.addEventListener("click", function (e) {
      if (dropdown.classList.contains("is-open") && !dropdown.contains(e.target)) closeCatMenu();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeCatMenu();
    });
  }

  // Community document submissions — fetched live so a newly approved template appears without
  // a full rebuild, same pattern as the chase-email index page.
  var communitySection = document.getElementById("tpl-community");
  var communityGrid = document.getElementById("tpl-community-grid");
  if (communitySection && communityGrid) {
    fetch("/api/marketplace?type=document")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var rows = (data && data.templates) || [];
        if (!rows.length) return;
        function esc(s) { return String(s || "").replace(/</g, "&lt;"); }
        rows.forEach(function (t) {
          var card = document.createElement("a");
          card.className = "tpl-card tpl-card-community";
          card.href = "#";
          var expertBadge = t.verifiedExpert ? '<span class="tpl-featured-badge">Verified expert</span>' : (t.featured ? '<span class="tpl-featured-badge">Featured</span>' : "");
          card.innerHTML =
            '<div class="tpl-meta"><span>' + esc(t.category) + "</span>" + expertBadge + "</div>" +
            "<h3>" + esc(t.name) + "</h3>" +
            "<p>" + esc(t.description) + "</p>";
          communityGrid.appendChild(card);
        });
        communitySection.hidden = false;
        var countEl2 = document.getElementById("tpl-count");
        if (countEl2) {
          var newTotal = ${DOCUMENT_TEMPLATES.length} + rows.length;
          countEl2.textContent = newTotal + " templates";
        }
      })
      .catch(function () {});
  }
})();
</script>`,
});

writeFileSync(join(docOutDir, "index.html"), docIndexHtml);
console.log(`Wrote ${DOCUMENT_TEMPLATES.length} document templates + index → ${docOutDir}`);

function markdownToHtml(md) {
  const lines = md.split("\n");
  const out = [];
  let inTable = false;
  let tableRowIndex = 0;
  let inList = false;
  let paragraph = [];

  function flushParagraph() {
    if (paragraph.length) {
      out.push(`<p>${inlineMd(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  }

  function closeTable() {
    if (inTable) {
      out.push("</table>");
      inTable = false;
      tableRowIndex = 0;
    }
  }

  function closeList() {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      closeTable();
      closeList();
      continue;
    }
    if (trimmed.startsWith("|")) {
      flushParagraph();
      closeList();
      const cells = trimmed
        .split("|")
        .map((c) => c.trim())
        .filter((c, i, arr) => !(i === 0 && c === "") && !(i === arr.length - 1 && c === ""));
      if (cells.every((c) => /^-+$/.test(c))) continue; // header separator row
      if (!inTable) {
        out.push("<table>");
        inTable = true;
      }
      const tag = tableRowIndex === 0 ? "th" : "td";
      out.push(`<tr>${cells.map((c) => `<${tag}>${inlineMd(c)}</${tag}>`).join("")}</tr>`);
      tableRowIndex += 1;
      continue;
    }
    if (trimmed !== "---" && /^[-*]\s+/.test(trimmed)) {
      flushParagraph();
      closeTable();
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inlineMd(trimmed.replace(/^[-*]\s+/, ""))}</li>`);
      continue;
    }
    closeTable();
    closeList();
    if (trimmed.startsWith("# ")) {
      flushParagraph();
      out.push(`<h1>${inlineMd(trimmed.slice(2))}</h1>`);
    } else if (trimmed.startsWith("## ")) {
      flushParagraph();
      out.push(`<h2>${inlineMd(trimmed.slice(3))}</h2>`);
    } else if (trimmed.startsWith("### ")) {
      flushParagraph();
      out.push(`<h3>${inlineMd(trimmed.slice(4))}</h3>`);
    } else if (trimmed === "---") {
      flushParagraph();
      out.push("<hr>");
    } else {
      paragraph.push(trimmed);
    }
  }
  flushParagraph();
  closeTable();
  closeList();
  return out.join("\n");
}

function inlineMd(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

for (const t of TEMPLATES) {
  const faq = buildTemplateFaq(t);
  const jsonLd = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Article",
          headline: t.seoTitle,
          description: t.description,
          url: `https://chasa.io/free-templates/${t.slug}`,
          author: { "@type": "Organization", name: "docstoc" },
          publisher: { "@type": "Organization", name: "RELACON GmbH" },
          mainEntityOfPage: `https://chasa.io/free-templates/${t.slug}`,
        },
        {
          "@type": "FAQPage",
          mainEntity: faq.map((item) => ({
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

  const others = TEMPLATES.filter((x) => x.slug !== t.slug)
    .slice(0, 5)
    .map((x) => `<li><a href="/free-templates/${x.slug}">${escapeHtml(x.name)}</a></li>`)
    .join("\n");

  const whatsIncluded = buildWhatsIncluded(t)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("\n        ");

  const useCases = buildUseCases(t)
    .map(
      (uc) => `<div class="tpl-usecase">
          <h3>${escapeHtml(uc.title)}</h3>
          <p>${escapeHtml(uc.desc)}</p>
        </div>`
    )
    .join("\n        ");

  const faqHtml = faq
    .map(
      (item) =>
        `<details class="faq-item"><summary>${escapeHtml(item.q)}</summary>\n<p>${escapeHtml(item.a)}</p>\n</details>`
    )
    .join("\n      ");

  const page = chrome({
    title: `${t.seoTitle} | docstoc`,
    description: t.description,
    canonical: `https://chasa.io/free-templates/${t.slug}`,
    activeNav: "templates",
    jsonLd,
    mainHtml: `<main class="wrap template-detail">
  <p class="crumb"><a href="/">Home</a> / <a href="/free-templates/">Free templates</a> / ${escapeHtml(t.name)}</p>
  <div class="tpl-meta"><span>${escapeHtml(t.stage)}</span><span>${escapeHtml(t.tone)}</span></div>
  <h1>${escapeHtml(t.name)}</h1>
  <p class="lede">${escapeHtml(t.description)}</p>
  <div class="tpl-hero-cta">
    <a class="nav-cta" href="/app/login?start=1">Try free — no signup, no card</a>
  </div>
  ${trustBadgesHtml()}

  <p class="tpl-seo-intro">${buildSeoIntro(t)}</p>

  <div class="tpl-box">
    <div class="tpl-label">Subject</div>
    <pre class="tpl-subject">${escapeHtml(t.subject)}</pre>
    <div class="tpl-label">Body</div>
    <pre class="tpl-body">${escapeHtml(t.body)}</pre>
    <button type="button" class="btn-copy" data-copy="${encodeURIComponent(`Subject: ${t.subject}\n\n${t.body}`)}">Copy subject + body</button>
  </div>

  <h2>What's included</h2>
  <ul class="tpl-included">
        ${whatsIncluded}
  </ul>

  <h2>Who this template is for</h2>
  <div class="tpl-usecases">
        ${useCases}
  </div>

  <div class="ai-tools-panel tpl-ai-teaser">
    <div class="ai-tools-label">AI tools <span class="paid-pill">Paid</span></div>
    <p class="tpl-ai-intro">Copy this template free. Soften, firm up, or shorten a draft for your exact invoice on Solo or Pro.</p>
    <div class="ai-tool-card ai-tool-teaser" aria-disabled="true">
      <span class="ai-tool-icon" aria-hidden="true">↓</span>
      <span class="ai-tool-copy">
        <strong>Soften</strong>
        <span>Less pressure, still asks for payment</span>
      </span>
    </div>
    <div class="ai-tool-card ai-tool-teaser" aria-disabled="true">
      <span class="ai-tool-icon" aria-hidden="true">↑</span>
      <span class="ai-tool-copy">
        <strong>Firm up</strong>
        <span>Clearer urgency when polite reminders were ignored</span>
      </span>
    </div>
    <div class="ai-tool-card ai-tool-teaser" aria-disabled="true">
      <span class="ai-tool-icon" aria-hidden="true">✂</span>
      <span class="ai-tool-copy">
        <strong>Make shorter</strong>
        <span>Tight version under ~60 words</span>
      </span>
    </div>
    <div class="tpl-cta tpl-cta-compact">
      <p>Unlock AI tools from Solo · $7/mo</p>
      <a class="nav-cta" href="/app/account">Upgrade to Solo</a>
    </div>
  </div>

  <h2>FAQ</h2>
  ${faqHtml}

  <h2>More free templates</h2>
  <ul class="tpl-more">${others}
  </ul>

  ${conversionSectionHtml()}

  <div class="tpl-cta-footer">
    <h2>Get paid faster, without the awkward part</h2>
    <p>Copy this template free, or let docstoc draft one matched to your exact invoice.</p>
    <a class="nav-cta" href="/app/login?start=1">Try docstoc free — no signup, no card</a>
  </div>
</main>
<script>
if (window.chasaTrack) {
  window.chasaTrack("template_opened");
  window.chasaTrack("template_used");
}
document.querySelectorAll(".btn-copy").forEach(function (btn) {
  btn.addEventListener("click", function () {
    var text = decodeURIComponent(btn.getAttribute("data-copy"));
    navigator.clipboard.writeText(text).then(function () {
      btn.textContent = "Copied";
      setTimeout(function () { btn.textContent = "Copy subject + body"; }, 1500);
      if (window.chasaTrack) {
        window.chasaTrack("template_started");
        window.chasaTrack("template_completed");
        window.chasaTrack("document_sent", { method: "copy" });
      }
    });
  });
});
</script>`,
  });

  writeFileSync(join(outDir, `${t.slug}.html`), page);
}

writeFileSync(join(outDir, "templates.json"), JSON.stringify(TEMPLATES, null, 2));
console.log(`Wrote ${TEMPLATES.length} templates + index + download → ${outDir}`);
