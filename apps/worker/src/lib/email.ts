import type { Env } from "../types";
import { trackEvent } from "./analytics";

const ACCENT = "#EC683C";
const INK = "#1B3155";
const MUTED_HEX = "#6B7A90";
const PAPER = "#F2F4F8";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Shared branded shell — same Swipesign-style pattern as Docracy: gray canvas, white card,
 *  centered logo, pill CTA. */
export function emailShell(appUrl: string, bodyHtml: string): string {
  const logo = `${appUrl.replace(/\/$/, "")}/brand/chasa-icon.png`;
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;">
  <tr>
    <td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;max-width:520px;width:100%;">
        <tr>
          <td align="center" style="padding:32px 32px 8px 32px;">
            <img src="${logo}" alt="Chasa" width="40" height="40" style="display:block;width:40px;height:40px;margin:0 auto 8px;border-radius:8px;" />
            <div style="font-size:22px;font-weight:700;letter-spacing:-0.03em;color:${ACCENT};">chasa</div>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 36px 36px 36px;">
            ${bodyHtml}
          </td>
        </tr>
      </table>
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
        <tr>
          <td style="padding:24px 32px 0 32px;text-align:center;font-size:12px;color:${MUTED_HEX};line-height:1.6;">
            Drafts only — you always send from your own inbox · <a href="${appUrl}" style="color:${MUTED_HEX};text-decoration:underline;">chasa.io</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim();
}

export function emailHeadline(text: string): string {
  return `<p style="margin:0 0 20px 0;font-size:22px;font-weight:700;color:${ACCENT};text-align:center;line-height:1.3;">${escapeHtml(text)}</p>`;
}

export function ctaButton(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto;"><tr><td align="center" style="border-radius:999px;background:${ACCENT};">
    <a href="${url}" style="display:inline-block;padding:14px 40px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
  </td></tr></table>`;
}

const SIGN_OFF = `<p style="margin:28px 0 0 0;font-size:15px;color:${INK};line-height:1.5;">Until soon,<br><em style="font-style:italic;color:${MUTED_HEX};">Chasa</em></p>`;

function appUrl(env: Env): string {
  return (env.PUBLIC_APP_URL || "https://chasa.io").replace(/\/$/, "");
}

// Falls back to logging when RESEND_API_KEY isn't set, so local dev never blocks on a missing secret.
export async function sendMagicLinkEmail(env: Env, email: string, verifyUrl: string): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.log(`[dev] magic link email queued for ${email} (token not logged)`);
    await trackEvent(env, {
      name: "email_sent",
      properties: { type: "onboarding", channel: "dev" },
      path: "/api/auth/request",
    }).catch(() => {});
    return;
  }

  const body = `
    ${emailHeadline("Sign in to Chasa")}
    <p style="margin:0;font-size:15px;color:${INK};line-height:1.55;">
      Click the button below to sign in. This link expires in 15 minutes and can only be used once.
    </p>
    ${ctaButton(verifyUrl, "Sign in")}
    <p style="margin:0;font-size:13px;color:${MUTED_HEX};line-height:1.5;">
      If you didn't request this, you can safely ignore this email.
    </p>
    ${SIGN_OFF}
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Chasa <login@chasa.io>`,
      to: [email],
      subject: "Your Chasa sign-in link",
      html: emailShell(appUrl(env), body),
    }),
  });

  if (!res.ok) {
    console.error(`Resend send failed (${res.status}): ${await res.text()}`);
    await trackEvent(env, {
      name: "email_bounced",
      properties: { type: "onboarding", status: res.status },
      path: "/api/auth/request",
    }).catch(() => {});
    return;
  }

  await trackEvent(env, {
    name: "email_sent",
    properties: { type: "onboarding" },
    path: "/api/auth/request",
  }).catch(() => {});
}

export async function sendTeamInviteEmail(
  env: Env,
  to: string,
  inviterEmail: string,
  inviteUrl: string
): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.log(`[dev] team invite email queued for ${to} (link not logged)`);
    return;
  }

  const body = `
    ${emailHeadline("You're invited to a Chasa workspace")}
    <p style="margin:0;font-size:15px;color:${INK};line-height:1.55;">
      ${escapeHtml(inviterEmail)} invited you to collaborate on invoice follow-ups in Chasa.
      Sign in with <strong>${escapeHtml(to)}</strong> to join. Chasa never emails your clients — drafts only.
    </p>
    ${ctaButton(inviteUrl, "Accept invite")}
    ${SIGN_OFF}
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Chasa <login@chasa.io>`,
      to: [to],
      subject: `${inviterEmail} invited you to a Chasa workspace`,
      html: emailShell(appUrl(env), body),
    }),
  });
  if (!res.ok) {
    console.error(`Resend invite failed (${res.status}): ${await res.text()}`);
  }
}

function greetingName(email: string): string {
  const local = email.split("@")[0] || "";
  const token = local.split(/[._+-]/)[0] || "";
  if (!token || token.length < 2) return "there";
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

/** Welcome email after someone downloads the polite templates PDF pack. */
export async function sendTemplatesPackWelcomeEmail(
  env: Env,
  email: string,
  opts: { downloadUrl: string; unsubUrl: string; firstName?: string | null }
): Promise<void> {
  const base = appUrl(env);
  const name =
    (opts.firstName && opts.firstName.trim()) ||
    greetingName(email);
  const articles = [
    {
      title: "How to follow up on overdue invoices (without burning bridges)",
      href: `${base}/blog/how-to-follow-up-on-overdue-invoices/`,
    },
    {
      title: "Building an AR policy that works with Chasa",
      href: `${base}/blog/ar-policy-that-works-with-chasa/`,
    },
    {
      title: "Freelancer late payment policy",
      href: `${base}/blog/freelancer-late-payment-policy/`,
    },
  ];

  const articleList = articles
    .map(
      (a) =>
        `<li style="margin:0 0 8px 0;"><a href="${a.href}" style="color:${ACCENT};text-decoration:underline;">${escapeHtml(a.title)}</a></li>`
    )
    .join("");

  const body = `
    <p style="margin:0 0 16px 0;font-size:15px;color:${INK};line-height:1.55;">
      Hi ${escapeHtml(name)},
    </p>
    <p style="margin:0 0 16px 0;font-size:15px;color:${INK};line-height:1.55;">
      Thanks for downloading our politely worded invoice templates. They’re yours to copy,
      personalize, and send from your own inbox — no awkward blank page.
    </p>
    ${ctaButton(opts.downloadUrl, "Download the PDF again")}
    <p style="margin:0 0 12px 0;font-size:15px;color:${INK};line-height:1.55;">
      We keep publishing practical notes for freelancers and small teams. These may help next:
    </p>
    <ul style="margin:0 0 20px 0;padding-left:20px;font-size:15px;color:${INK};line-height:1.5;">
      ${articleList}
    </ul>
    <p style="margin:0 0 16px 0;font-size:15px;color:${INK};line-height:1.55;">
      Prefer not to rewrite every chase by hand? Paste unpaid invoices into Chasa and get a
      tone-matched draft for how late each one is. You still send — clients always hear from you,
      not from an automated collections domain.
    </p>
    ${ctaButton(`${base}/app/`, "Try Chasa free")}
    <p style="margin:0;font-size:13px;color:${MUTED_HEX};line-height:1.5;">
      Five AI drafts per month on Free · no card required.
    </p>
    ${SIGN_OFF}
    <p style="margin:24px 0 0 0;font-size:11px;color:${MUTED_HEX};line-height:1.55;text-align:center;">
      RELACON GmbH · Elisabethstraße 15/5b · 1010 Vienna · Austria<br/>
      <a href="${opts.unsubUrl}" style="color:${MUTED_HEX};text-decoration:underline;">Unsubscribe from template updates</a>
    </p>
  `;

  if (!env.RESEND_API_KEY) {
    console.log(`[dev] templates-pack welcome queued for ${email}`);
    await trackEvent(env, {
      name: "email_sent",
      properties: { type: "templates_pack_welcome", channel: "dev" },
      path: "/api/leads/templates-pack",
    }).catch(() => {});
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Chasa <login@chasa.io>`,
      to: [email],
      subject: "Your polite invoice templates (plus a few reads)",
      html: emailShell(base, body),
    }),
  });

  if (!res.ok) {
    console.error(`Resend templates-pack welcome failed (${res.status}): ${await res.text()}`);
    await trackEvent(env, {
      name: "email_bounced",
      properties: { type: "templates_pack_welcome", status: res.status },
      path: "/api/leads/templates-pack",
    }).catch(() => {});
    return;
  }

  await trackEvent(env, {
    name: "email_sent",
    properties: { type: "templates_pack_welcome" },
    path: "/api/leads/templates-pack",
  }).catch(() => {});
}
