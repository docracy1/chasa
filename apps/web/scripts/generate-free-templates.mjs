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
];

const TEMPLATES_INDEX_FAQ = [
  {
    q: "Are these invoice templates really free?",
    a: "Yes — all templates are free to view, copy, and edit with no account or signup required. Chasa never emails your clients for you; you copy the draft into your own inbox.",
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
        isPartOf: { "@type": "WebSite", name: "Chasa", url: "https://chasa.io" },
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
  title: `Free Invoice Payment Reminder Email Templates (${tplCount}) | Chasa`,
  description: `${tplCount} free payment reminder and overdue invoice email templates for freelancers. Copy, personalize, and send — or generate a tone-matched draft in Chasa.`,
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
    plus thank-yous, disputes, and multi-invoice summaries. Original Chasa wording; use as-is or let the
    <a href="/app/">AI tool</a> draft a version matched to how late the invoice is.
  </p>

  <div id="tpl-sections">
${categorySections}
  </div>
  <p class="tpl-no-results" id="tpl-no-results" hidden>No templates match &ldquo;<span id="tpl-no-results-q"></span>&rdquo;. <a href="/app/">Try the AI tool</a> instead?</p>

  <section class="tpl-cat-section" id="tpl-community" hidden>
    <h2 class="tpl-cat-title">Community templates</h2>
    <p class="tpl-index-note">Submitted by other Chasa users, reviewed before publishing. <a href="/free-templates/submit">Share your own</a>.</p>
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
    name: `Download ${tplCount} polite invoice templates — Chasa`,
    description: `Free PDF pack of ${tplCount} politely worded payment reminder emails. Enter your details to download.`,
    url: "https://chasa.io/free-templates/download",
    isPartOf: { "@type": "WebSite", name: "Chasa", url: "https://chasa.io" },
  },
  null,
  2
);

const downloadHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Download ${tplCount} polite invoice templates — Chasa</title>
<meta name="description" content="Free PDF pack of ${tplCount} politely worded payment reminder emails for freelancers and small teams. Download with the Chasa logo.">
<link rel="canonical" href="https://chasa.io/free-templates/download">
<meta property="og:type" content="website">
<meta property="og:title" content="Download ${tplCount} polite invoice templates — Chasa">
<meta property="og:description" content="Free PDF pack of ${tplCount} politely worded payment reminder emails. Enter your details to download.">
<meta property="og:url" content="https://chasa.io/free-templates/download">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="Download ${tplCount} polite invoice templates — Chasa">
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
    <a href="/" class="lead-pack-brand" aria-label="Chasa home">
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
        This free PDF packs every Chasa template into one branded guide: subjects, bodies, and stage notes
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
          Chasa will use the contact information you provide to send the PDF and occasional product tips.
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
    name: "Submit your own invoice follow-up template — Chasa",
    description:
      "Share a payment reminder or invoice follow-up email that's worked for you. Reviewed by Chasa, then published free for everyone.",
    url: "https://chasa.io/free-templates/submit",
    isPartOf: { "@type": "WebSite", name: "Chasa", url: "https://chasa.io" },
  },
  null,
  2
);

const submitHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Submit Your Invoice Follow-Up Template — Chasa</title>
<meta name="description" content="Share a payment reminder or invoice follow-up email that's worked for you. Reviewed by Chasa, then published free on our template library.">
<link rel="canonical" href="https://chasa.io/free-templates/submit">
<meta property="og:type" content="website">
<meta property="og:title" content="Submit Your Invoice Follow-Up Template — Chasa">
<meta property="og:description" content="Share a payment reminder or invoice follow-up email that's worked for you. Reviewed by Chasa, then published free on our template library.">
<meta property="og:url" content="https://chasa.io/free-templates/submit">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="Submit Your Invoice Follow-Up Template — Chasa">
<meta name="twitter:description" content="Share a payment reminder or invoice follow-up email that's worked for you. Reviewed by Chasa, then published free on our template library.">
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
    <a href="/" class="lead-pack-brand" aria-label="Chasa home">
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
    name: "10 new free invoice follow-up templates — Chasa",
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
<title>10 New Free Invoice Follow-Up Templates | Chasa</title>
<meta name="description" content="10 new free invoice follow-up templates for freelancers, agencies, and corporate finance teams — plus a legal-tone final notice and a template for when a client goes silent. Now ${tplCount} templates and counting.">
<link rel="canonical" href="https://chasa.io/free-templates/new">
<meta property="og:type" content="website">
<meta property="og:title" content="10 New Free Invoice Follow-Up Templates">
<meta property="og:description" content="Freelancer, agency, and corporate invoice follow-up templates — plus a legal-tone final notice and a template for when a client goes silent. Free, copy-paste ready.">
<meta property="og:url" content="https://chasa.io/free-templates/new">
<meta property="og:image" content="https://chasa.io/brand/og/chasa-og-1200x630.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="10 New Free Invoice Follow-Up Templates">
<meta name="twitter:description" content="Freelancer, agency, and corporate invoice follow-up templates — plus a legal-tone final notice and a template for when a client goes silent. Free, copy-paste ready.">
<meta name="twitter:image" content="https://chasa.io/brand/og/chasa-og-1200x630.png">
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
    <a href="/" class="lead-pack-brand" aria-label="Chasa home">
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
  return `Getting paid on time is hard enough without also having to write the follow-up email yourself. This free ${t.name.toLowerCase()} template is built specifically for ${framing.audience} ${framing.problem}. Instead of starting from a blank page or reusing a generic payment reminder email that doesn't quite match how late the invoice is, you get a ${t.tone.toLowerCase()}-toned, ready-to-send draft matched to this exact stage: ${t.stage.toLowerCase()}. Copy the subject and body as-is, swap in your invoice details, and send it from Gmail, Outlook, or Apple Mail — no account, no signup, and no software to install. It's one of 28 free invoice follow-up templates and payment reminder emails on Chasa, covering everything from a friendly nudge before an invoice is even due through a formal final notice. If you'd rather have the wording generated fresh for your exact invoice, amount, and client, Chasa's AI tool drafts that automatically — this template stays free either way, with or without an account.`;
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
      a: `Yes — every template in Chasa's library is free to view, copy, and edit with no account or signup required. Chasa never emails your clients on your behalf; you copy this draft into your own inbox and send it yourself, so there's nothing to sign up for just to use the wording.`,
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
      q: "Does Chasa's AI tool improve on this template?",
      a: "Yes. This page gives you the wording for free with no signup. Chasa's AI tool goes further on Solo and Pro plans — it drafts a version matched to your exact invoice amount, client name, and how many days overdue it is, and can soften, firm up, or shorten a draft on request.",
    },
    {
      q: "What if the client still doesn't pay after I send this?",
      a: "If this reminder doesn't get a response, the next step is usually a firmer follow-up or a formal notice, depending on how late the invoice becomes. Chasa's free library includes templates for every stage, from a gentle first nudge through a final notice before collections.",
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
  return `Drafting a ${t.name.toLowerCase()} from scratch is slow, and generic templates often miss the sections that actually matter. This free template is built for ${framing.audience} ${framing.problem}. It's structured with the standard sections a document like this needs, with clearly marked [placeholder] fields so you can fill in your own details quickly. Copy it into your own word processor, fill in the placeholders, and review it — or adapt it — before use. It's part of Chasa's free document template library, alongside business, legal, real estate, finance, and HR templates. Every template here is free to copy with no signup required, and each one carries a plain disclaimer: this is a starting point for informational purposes, not a substitute for advice from a licensed professional in your jurisdiction.`;
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
          author: { "@type": "Organization", name: "Chasa" },
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
    title: `${t.seoTitle} | Chasa`,
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
    q: "How is this different from Chasa's invoice email templates?",
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
        isPartOf: { "@type": "WebSite", name: "Chasa", url: "https://chasa.io" },
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
  title: `Free Business & Legal Document Templates (${DOCUMENT_TEMPLATES.length}) | Chasa`,
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
    <p class="tpl-index-note">Submitted by other Chasa users, reviewed before publishing.</p>
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
          author: { "@type": "Organization", name: "Chasa" },
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
    title: `${t.seoTitle} | Chasa`,
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
    <p>Copy this template free, or let Chasa draft one matched to your exact invoice.</p>
    <a class="nav-cta" href="/app/login?start=1">Try Chasa free — no signup, no card</a>
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
