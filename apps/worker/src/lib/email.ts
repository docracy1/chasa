import type { Env } from "../types";
import { trackEvent } from "./analytics";

// Falls back to logging the link to the console when RESEND_API_KEY isn't set, so local dev
// (and any deployment before Resend is wired up) never blocks on a missing secret.
export async function sendMagicLinkEmail(env: Env, email: string, verifyUrl: string): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.log(`[dev] magic link for ${email}: ${verifyUrl}`);
    await trackEvent(env, {
      name: "email_sent",
      properties: { type: "onboarding", channel: "dev" },
      path: "/api/auth/request",
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
      subject: "Your Chasa sign-in link",
      html: `<p>Click below to sign in to Chasa. This link expires in 15 minutes.</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
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
