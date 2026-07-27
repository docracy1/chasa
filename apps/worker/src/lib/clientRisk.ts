import type { Env } from "../types";

/** Recompute risk score (0–100, higher = riskier) from client payment history. */
export async function recomputeClientRisk(
  env: Env,
  accountId: string,
  clientId: string
): Promise<{ riskScore: number; avgDaysLate: number | null }> {
  const client = await env.CHASA_DB.prepare(
    `SELECT paid_invoice_count, late_invoice_count, avg_days_late FROM clients WHERE id = ? AND account_id = ?`
  )
    .bind(clientId, accountId)
    .first<{
      paid_invoice_count: number;
      late_invoice_count: number;
      avg_days_late: number | null;
    }>();

  if (!client) return { riskScore: 50, avgDaysLate: null };

  const paid = client.paid_invoice_count ?? 0;
  const late = client.late_invoice_count ?? 0;
  const total = paid + late;

  let riskScore = 50;
  if (total > 0) {
    const lateRatio = late / total;
    riskScore = Math.round(Math.min(95, Math.max(5, lateRatio * 70 + (client.avg_days_late ?? 0) * 0.5)));
  }

  await env.CHASA_DB.prepare(
    `UPDATE clients SET risk_score = ?, updated_at = ? WHERE id = ? AND account_id = ?`
  )
    .bind(riskScore, new Date().toISOString(), clientId, accountId)
    .run();

  return { riskScore, avgDaysLate: client.avg_days_late };
}

export async function recordClientPaymentOutcome(
  env: Env,
  accountId: string,
  clientId: string,
  opts: { daysLate: number; markedPaid: boolean }
): Promise<void> {
  const row = await env.CHASA_DB.prepare(
    `SELECT paid_invoice_count, late_invoice_count, avg_days_late FROM clients WHERE id = ? AND account_id = ?`
  )
    .bind(clientId, accountId)
    .first<{
      paid_invoice_count: number;
      late_invoice_count: number;
      avg_days_late: number | null;
    }>();

  if (!row) return;

  const paid = row.paid_invoice_count + (opts.markedPaid ? 1 : 0);
  const late = row.late_invoice_count + (opts.daysLate > 0 ? 1 : 0);
  const prevAvg = row.avg_days_late ?? 0;
  const prevCount = row.paid_invoice_count + row.late_invoice_count;
  const newAvg =
    prevCount > 0
      ? (prevAvg * prevCount + Math.max(0, opts.daysLate)) / (prevCount + 1)
      : Math.max(0, opts.daysLate);

  await env.CHASA_DB.prepare(
    `UPDATE clients SET paid_invoice_count = ?, late_invoice_count = ?, avg_days_late = ?, updated_at = ?
     WHERE id = ? AND account_id = ?`
  )
    .bind(paid, late, newAvg, new Date().toISOString(), clientId, accountId)
    .run();

  await recomputeClientRisk(env, accountId, clientId);
}
