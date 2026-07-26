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

export async function generateFollowUpEmail(
  env: Env,
  input: { clientName: string; invoiceAmount: number; daysOverdue: number }
): Promise<GeneratedEmail> {
  const band = getToneBand(input.daysOverdue);
  const userMessage = `${BAND_INSTRUCTIONS[band]}

client_name: ${input.clientName}
invoice_amount: $${input.invoiceAmount.toFixed(2)}
days_overdue: ${input.daysOverdue}
tone_band: ${band}`;

  const result = await env.AI.run((env.WORKERS_AI_MODEL || DEFAULT_MODEL) as keyof AiModels, {
    temperature: 0.4,
    max_tokens: 400,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  const text = (result as { response?: string }).response ?? "";
  return parseEmail(text);
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
