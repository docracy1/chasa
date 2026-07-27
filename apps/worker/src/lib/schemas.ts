import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const magicLinkRequestSchema = z.object({
  email: z.string().trim().email().max(254),
  turnstileToken: z.string().optional(),
});

export const analyticsTrackSchema = z.object({
  name: z.string().min(1).max(80),
  properties: z
    .record(z.string(), z.unknown())
    .refine((obj) => JSON.stringify(obj).length <= 2048, "properties too large")
    .optional(),
  visitorId: z.string().max(80).optional(),
  path: z.string().max(300).optional(),
});

export const analyticsPageviewSchema = z.object({
  path: z.string().max(300).optional(),
});

export const agingSyncItemSchema = z.object({
  id: z.string().max(64).optional(),
  clientName: z.string().trim().min(1).max(120),
  amount: z.coerce.number().finite().min(0).max(999_999_999),
  dueDate: isoDate,
  lastChaseStatus: z.string().trim().max(40).nullable().optional(),
  lastChaseAt: z.string().trim().max(40).nullable().optional(),
});

export const agingSyncSchema = z.object({
  invoices: z.array(agingSyncItemSchema).max(500),
  replace: z.boolean().optional(),
});

export const agingChaseSchema = z.object({
  status: z.string().trim().max(40).optional(),
});

export const generateEmailSchema = z.object({
  client_name: z.string().max(120).optional(),
  invoice_amount: z.coerce.number().finite().min(0).max(999_999_999).optional(),
  days_overdue: z.coerce.number().finite().min(0).max(3650).optional(),
  payment_link: z.string().max(500).optional(),
  visitorId: z.string().max(80).optional(),
  invoices: z
    .array(
      z.object({
        client_name: z.string().max(120).optional(),
        invoice_amount: z.coerce.number().finite().optional(),
        amount: z.coerce.number().finite().optional(),
        days_overdue: z.coerce.number().finite().min(0).max(3650).optional(),
        due_date: z.string().max(20).optional(),
      })
    )
    .max(50)
    .optional(),
});

export const rewriteEmailSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(8000),
  action: z.enum(["softer", "firmer", "shorter"]),
});

export const thankYouSchema = z.object({
  client_name: z.string().trim().min(1).max(120),
  invoice_amount: z.coerce.number().finite().min(0).max(999_999_999),
});

export const replyEmailSchema = z.object({
  client_name: z.string().trim().min(1).max(120),
  invoice_amount: z.coerce.number().finite().min(0).max(999_999_999),
  days_overdue: z.coerce.number().finite().min(0).max(3650),
  client_message: z.string().trim().min(1).max(4000),
});

export const sequenceEmailSchema = z.object({
  client_name: z.string().trim().min(1).max(120),
  invoice_amount: z.coerce.number().finite().min(0).max(999_999_999),
  days_overdue: z.coerce.number().finite().min(0).max(3650),
  aging_invoice_id: z.string().max(64).optional(),
});

export const smsEmailSchema = z.object({
  client_name: z.string().trim().min(1).max(120),
  invoice_amount: z.coerce.number().finite().min(0).max(999_999_999),
  days_overdue: z.coerce.number().finite().min(0).max(3650),
  phone: z.string().max(40).optional(),
});

export const v1ChaseDraftSchema = z.object({
  client_name: z.string().max(120).optional(),
  customer: z.string().max(120).optional(),
  invoice_amount: z.coerce.number().finite().optional(),
  amount: z.coerce.number().finite().optional(),
  days_overdue: z.coerce.number().finite().min(0).max(3650).optional(),
  due_date: z.string().max(20).optional(),
  dueDate: z.string().max(20).optional(),
});

export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function parseJsonBody<T>(
  req: { json: () => Promise<unknown> },
  schema: z.ZodType<T>
): Promise<ParseResult<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const msg = result.error.issues.map((i) => i.message).join("; ") || "Invalid request body";
    return { ok: false, error: msg };
  }
  return { ok: true, data: result.data };
}
