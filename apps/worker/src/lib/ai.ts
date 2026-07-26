import type { Env } from "../types";

export type ToneBand = "1-7" | "8-30" | "30+";

export function getToneBand(daysOverdue: number): ToneBand {
  if (daysOverdue <= 7) return "1-7";
  if (daysOverdue <= 30) return "8-30";
  return "30+";
}

// Each band gets its own instruction, not just "make it firmer" — a 3-day-late email should read
// like a text from a colleague, a 45-day-late one like something a controller signs their name to.
const BAND_INSTRUCTIONS: Record<ToneBand, string> = {
  "1-7":
    "Tone band 1-7 days overdue: friendly, assumes it's an oversight. Light reminder, no pressure, casual — like a quick note from a colleague. No mention of consequences.",
  "8-30":
    "Tone band 8-30 days overdue: professional, clear ask. State the amount and due date plainly, ask for a specific payment date. Still courteous, but no longer casual.",
  "30+":
    "Tone band 30+ days overdue: direct, sets a consequence. Mention a late fee or a concrete next step (e.g. pausing further work) if it fits. Do not apologize for asking to be paid.",
};

const SYSTEM_PROMPT = `You write short, direct payment follow-up emails for freelancers and small businesses.
Match the tone to the days-overdue band provided. Never grovel, never threaten unless the band says to.
No corporate filler language. Keep the body under 100 words.

Respond in exactly this format, nothing else:
Subject: <subject line>
Body:
<email body>`;

// Cloudflare Workers AI — free (10k neurons/day, resets daily), no external account or API key.
const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";

export interface GeneratedEmail {
  subject: string;
  body: string;
}

export type FollowUpInvoiceLine = {
  clientName?: string;
  amount: number;
  daysOverdue: number;
  dueDate?: string;
};

export type FollowUpEmailInput = {
  clientName: string;
  invoiceAmount: number;
  daysOverdue: number;
  /** When length > 1, draft lists every invoice (multi-invoice chase). */
  invoices?: FollowUpInvoiceLine[];
  /** Optional Stripe/PayPal/Wise/etc. URL to include in the body. */
  paymentLink?: string;
  /** Optional late fee / interest hint when user enabled it. */
  lateFeeHint?: string;
};

function appendPaymentLink(draft: GeneratedEmail, paymentLink?: string): GeneratedEmail {
  const link = paymentLink?.trim();
  if (!link) return draft;
  if (draft.body.includes(link)) return draft;
  return {
    ...draft,
    body: `${draft.body.trim()}\n\nPay here: ${link}`,
  };
}

export async function generateFollowUpEmail(
  env: Env,
  input: FollowUpEmailInput
): Promise<GeneratedEmail> {
  const lines =
    input.invoices && input.invoices.length > 0
      ? input.invoices
      : [{ amount: input.invoiceAmount, daysOverdue: input.daysOverdue }];

  const maxDays = Math.max(...lines.map((l) => l.daysOverdue), input.daysOverdue);
  const band = getToneBand(maxDays);
  const multi = lines.length > 1;
  const paymentLink = input.paymentLink?.trim();

  const invoiceBlock = lines
    .map((l, i) => {
      const who = l.clientName?.trim() || input.clientName;
      const due = l.dueDate ? `, due ${l.dueDate}` : "";
      return `- invoice ${i + 1}: client=${who}, amount=$${l.amount.toFixed(2)}, days_overdue=${l.daysOverdue}${due}`;
    })
    .join("\n");

  const multiHint = multi
    ? `This is a MULTI-INVOICE chase. Address the primary client name, list every invoice with amount and due/overdue context in the body, and ask for payment on all open items (or a payment plan covering the total).`
    : "";

  const payHint = paymentLink
    ? `Include this payment link once near the end of the body (do not invent other URLs): ${paymentLink}`
    : "Do not invent a payment link.";

  const lateFee = input.lateFeeHint?.trim();
  const lateHint = lateFee
    ? `The user opted in to mention late fees / interest. Include one short factual line about: ${lateFee}. Do not invent amounts beyond what they provided.`
    : "Do not invent late fees or interest charges.";

  const userMessage = `${BAND_INSTRUCTIONS[band]}
${multiHint}

client_name: ${input.clientName}
invoice_count: ${lines.length}
total_amount: $${lines.reduce((s, l) => s + l.amount, 0).toFixed(2)}
max_days_overdue: ${maxDays}
tone_band: ${band}
invoices:
${invoiceBlock}
${payHint}
${lateHint}`;

  const result = await env.AI.run((env.WORKERS_AI_MODEL || DEFAULT_MODEL) as keyof AiModels, {
    temperature: 0.4,
    max_tokens: multi ? 550 : 400,
    messages: [
      {
        role: "system",
        content: multi
          ? SYSTEM_PROMPT.replace("Keep the body under 100 words.", "Keep the body under 160 words.")
          : SYSTEM_PROMPT,
      },
      { role: "user", content: userMessage },
    ],
  });

  const text = (result as { response?: string }).response ?? "";
  return appendPaymentLink(parseEmail(text), paymentLink);
}

export type RewriteAction = "softer" | "firmer" | "shorter";

const REWRITE_INSTRUCTIONS: Record<RewriteAction, string> = {
  softer:
    "Rewrite softer: warmer, less pressure, still asks for payment. Remove threats/consequences. Keep facts (amount, due context).",
  firmer:
    "Rewrite firmer: clearer urgency, direct ask for a payment date. May mention pausing work or next steps. Still professional, not rude.",
  shorter:
    "Rewrite shorter: keep under 60 words. One clear ask. Drop filler greetings and closings fluff. Keep amount if present.",
};

const REWRITE_SYSTEM = `You rewrite payment follow-up emails for freelancers.
Keep the same invoice facts. Do not invent new amounts or dates.
No corporate filler. Respond in exactly this format, nothing else:
Subject: <subject line>
Body:
<email body>`;

export async function rewriteFollowUpEmail(
  env: Env,
  input: { subject: string; body: string; action: RewriteAction }
): Promise<GeneratedEmail> {
  const userMessage = `${REWRITE_INSTRUCTIONS[input.action]}

Current subject: ${input.subject}
Current body:
${input.body}`;

  const result = await env.AI.run((env.WORKERS_AI_MODEL || DEFAULT_MODEL) as keyof AiModels, {
    temperature: 0.35,
    max_tokens: 400,
    messages: [
      { role: "system", content: REWRITE_SYSTEM },
      { role: "user", content: userMessage },
    ],
  });

  const text = (result as { response?: string }).response ?? "";
  return parseEmail(text);
}

function parseEmail(text: string): GeneratedEmail {
  const subjectMatch = text.match(/^Subject:\s*(.+)$/m);
  const bodyMatch = text.match(/Body:\s*([\s\S]+)$/);
  return {
    subject: subjectMatch?.[1]?.trim() || "Following up on your invoice",
    body: bodyMatch?.[1]?.trim() || text.trim(),
  };
}

export async function generateThankYouEmail(
  env: Env,
  input: { clientName: string; invoiceAmount: number }
): Promise<GeneratedEmail> {
  const userMessage = `Write a short warm thank-you email after the client paid.
client_name: ${input.clientName}
invoice_amount: $${input.invoiceAmount.toFixed(2)}
Keep under 60 words. No upsell. No corporate fluff.`;

  const result = await env.AI.run((env.WORKERS_AI_MODEL || DEFAULT_MODEL) as keyof AiModels, {
    temperature: 0.4,
    max_tokens: 300,
    messages: [
      {
        role: "system",
        content: `You write short thank-you emails after invoice payment for freelancers.
Respond in exactly this format, nothing else:
Subject: <subject line>
Body:
<email body>`,
      },
      { role: "user", content: userMessage },
    ],
  });

  const text = (result as { response?: string }).response ?? "";
  return parseEmail(text);
}

export async function generateReplyEmail(
  env: Env,
  input: {
    clientName: string;
    invoiceAmount: number;
    daysOverdue: number;
    clientMessage: string;
  }
): Promise<GeneratedEmail> {
  const band = getToneBand(input.daysOverdue);
  const userMessage = `${BAND_INSTRUCTIONS[band]}

The client replied to a payment chase. Draft a response that keeps the payment ask clear while addressing what they said.
client_name: ${input.clientName}
invoice_amount: $${input.invoiceAmount.toFixed(2)}
days_overdue: ${input.daysOverdue}
client_message:
"""
${input.clientMessage.slice(0, 2000)}
"""`;

  const result = await env.AI.run((env.WORKERS_AI_MODEL || DEFAULT_MODEL) as keyof AiModels, {
    temperature: 0.35,
    max_tokens: 450,
    messages: [
      {
        role: "system",
        content: `You write reply emails for freelancers chasing unpaid invoices.
Acknowledge the client's message briefly. Stay factual. Keep a clear payment ask or next step.
Do not invent promises you cannot keep. Under 120 words.
Respond in exactly this format, nothing else:
Subject: <subject line>
Body:
<email body>`,
      },
      { role: "user", content: userMessage },
    ],
  });

  const text = (result as { response?: string }).response ?? "";
  return parseEmail(text);
}

export type ChaseSequenceStep = {
  step: number;
  daysFromNow: number;
  label: string;
  subject: string;
  body: string;
};

export async function generateChaseSequence(
  env: Env,
  input: { clientName: string; invoiceAmount: number; daysOverdue: number }
): Promise<{ tip: string; steps: ChaseSequenceStep[] }> {
  const band = getToneBand(input.daysOverdue);
  const userMessage = `Plan a 3-step chase sequence for this overdue invoice. User sends each email manually.
client_name: ${input.clientName}
invoice_amount: $${input.invoiceAmount.toFixed(2)}
days_overdue_today: ${input.daysOverdue}
current_tone_band: ${band}

Return exactly this format:
Tip: <one sentence on timing>
---
Step: 1
DaysFromNow: 0
Label: <short label>
Subject: <subject>
Body:
<body>
---
Step: 2
DaysFromNow: <integer days until next send>
Label: <short label>
Subject: <subject>
Body:
<body>
---
Step: 3
DaysFromNow: <integer days until third send from today>
Label: <short label>
Subject: <subject>
Body:
<body>`;

  const result = await env.AI.run((env.WORKERS_AI_MODEL || DEFAULT_MODEL) as keyof AiModels, {
    temperature: 0.35,
    max_tokens: 900,
    messages: [
      {
        role: "system",
        content: `You plan invoice chase sequences for freelancers. Escalate tone across steps.
Step 1 is send now (DaysFromNow 0). Later steps are spaced a few days to ~1–2 weeks apart.
Keep each body under 90 words. No corporate filler.`,
      },
      { role: "user", content: userMessage },
    ],
  });

  const text = (result as { response?: string }).response ?? "";
  return parseSequence(text, input);
}

function parseSequence(
  text: string,
  input: { clientName: string; invoiceAmount: number; daysOverdue: number }
): { tip: string; steps: ChaseSequenceStep[] } {
  const tipMatch = text.match(/^Tip:\s*(.+)$/m);
  const tip = tipMatch?.[1]?.trim() || "Send now, then follow up if still unpaid.";
  const chunks = text.split(/\n---\n/).slice(1);
  const steps: ChaseSequenceStep[] = [];

  for (const chunk of chunks) {
    const step = Number(chunk.match(/^Step:\s*(\d+)/m)?.[1] ?? steps.length + 1);
    const daysFromNow = Number(chunk.match(/^DaysFromNow:\s*(\d+)/m)?.[1] ?? 0);
    const label = chunk.match(/^Label:\s*(.+)$/m)?.[1]?.trim() || `Step ${step}`;
    const subject =
      chunk.match(/^Subject:\s*(.+)$/m)?.[1]?.trim() || `Following up — ${input.clientName}`;
    const body = chunk.match(/^Body:\s*([\s\S]+?)(?=\nStep:|\n---|$)/m)?.[1]?.trim()
      || chunk.match(/^Body:\s*([\s\S]+)$/m)?.[1]?.trim()
      || "";
    if (body) {
      steps.push({
        step,
        daysFromNow: Number.isFinite(daysFromNow) ? daysFromNow : 0,
        label,
        subject,
        body,
      });
    }
  }

  if (steps.length === 0) {
    // Deterministic fallback if the model format slips
    const fallbackDays = input.daysOverdue <= 7 ? [0, 5, 12] : input.daysOverdue <= 30 ? [0, 4, 10] : [0, 3, 7];
    const labels = ["Friendly nudge", "Clear ask", "Direct follow-up"];
    for (let i = 0; i < 3; i++) {
      steps.push({
        step: i + 1,
        daysFromNow: fallbackDays[i],
        label: labels[i],
        subject: `Invoice follow-up — ${input.clientName}`,
        body: `Hi ${input.clientName},\n\nFollowing up on the $${input.invoiceAmount.toFixed(2)} invoice (${input.daysOverdue + fallbackDays[i]} days overdue). Please confirm a payment date.\n\nThanks`,
      });
    }
  }

  return { tip, steps: steps.slice(0, 3) };
}

export type SmsWhatsAppDraft = {
  sms: string;
  whatsapp: string;
  smsUri: string;
  whatsappUri: string;
};

/** Short SMS + WhatsApp copy — user copies or opens sms:/wa.me links. Chasa never sends. */
export async function generateSmsWhatsAppDraft(
  env: Env,
  input: {
    clientName: string;
    invoiceAmount: number;
    daysOverdue: number;
    phone?: string;
    lateFeeHint?: string;
  }
): Promise<SmsWhatsAppDraft> {
  const band = getToneBand(input.daysOverdue);
  const late = input.lateFeeHint?.trim()
    ? `Optional late-fee hint to weave in briefly if natural: ${input.lateFeeHint.trim()}`
    : "No late fee line.";

  const userMessage = `Write two short payment reminders for the same overdue invoice.
Tone band: ${band}
client_name: ${input.clientName}
invoice_amount: $${input.invoiceAmount.toFixed(2)}
days_overdue: ${input.daysOverdue}
${late}

Return exactly:
SMS:
<under 160 characters, plain text, no emoji spam>
---
WhatsApp:
<under 280 characters, friendly but clear, plain text>`;

  const result = await env.AI.run((env.WORKERS_AI_MODEL || DEFAULT_MODEL) as keyof AiModels, {
    temperature: 0.35,
    max_tokens: 350,
    messages: [
      {
        role: "system",
        content: `You write short SMS and WhatsApp payment reminders for freelancers.
Never threaten illegally. No corporate filler. User will send manually — you only draft.`,
      },
      { role: "user", content: userMessage },
    ],
  });

  const text = (result as { response?: string }).response ?? "";
  const smsMatch = text.match(/SMS:\s*([\s\S]+?)(?:\n---|\nWhatsApp:|$)/i);
  const waMatch = text.match(/WhatsApp:\s*([\s\S]+)$/i);
  let sms = (smsMatch?.[1] ?? "").trim().replace(/\s+/g, " ").slice(0, 160);
  let whatsapp = (waMatch?.[1] ?? "").trim().slice(0, 280);
  if (!sms) {
    sms = `Hi ${input.clientName}, gentle reminder: $${input.invoiceAmount.toFixed(2)} is ${input.daysOverdue}d overdue. Can you confirm a payment date?`;
  }
  if (!whatsapp) {
    whatsapp = `Hi ${input.clientName} — following up on the $${input.invoiceAmount.toFixed(2)} invoice (${input.daysOverdue} days overdue). Could you share a payment date? Thanks!`;
  }

  const phone = (input.phone ?? "").replace(/[^\d+]/g, "");
  const smsUri = phone
    ? `sms:${phone}?&body=${encodeURIComponent(sms)}`
    : `sms:?&body=${encodeURIComponent(sms)}`;
  const waPhone = phone.replace(/^\+/, "");
  const whatsappUri = waPhone
    ? `https://wa.me/${waPhone}?text=${encodeURIComponent(whatsapp)}`
    : `https://wa.me/?text=${encodeURIComponent(whatsapp)}`;

  return { sms, whatsapp, smsUri, whatsappUri };
}
