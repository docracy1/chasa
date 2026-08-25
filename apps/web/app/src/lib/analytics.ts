import { hasAnalyticsConsent } from "./consent";

const VISITOR_KEY = "docstoc_vid";
const EXCLUDE_KEY = "docstoc_exclude_self";

function visitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

export function isExcludeSelf(): boolean {
  try {
    return localStorage.getItem(EXCLUDE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setExcludeSelf(on: boolean): void {
  try {
    localStorage.setItem(EXCLUDE_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** Docstoc chase product events — keep in sync with worker allowlist */
export type AnalyticsEvent =
  | "signup_started"
  | "signup_completed"
  | "dashboard_loaded"
  | "upload_started"
  | "invoice_uploaded"
  | "template_opened"
  | "template_used"
  | "fields_added"
  | "chase_drafted"
  | "chase_sent"
  | "chase_downloaded"
  | "chase_opened"
  | "chase_completed"
  | "aging_cleared"
  | "client_created"
  | "client_updated"
  | "client_deleted"
  | "client_contact_note"
  | "client_chase_drafted"
  | "quota_wall_shown"
  | "quota_wall_upgrade_clicked"
  | "quota_wall_signin_clicked"
  | "upgrade_clicked"
  | "checkout_started"
  | "checkout_completed"
  | "template_category_viewed"
  | "template_preview_opened"
  | "template_started"
  | "template_abandoned"
  | "template_completed"
  | "landingpage_loaded"
  | "landingpage_cta_clicked"
  | "referral_source_detected"
  | "blog_article_loaded"
  | "blog_cta_clicked"
  | "page_viewed"
  | "scroll_depth_reached"
  | "email_sent"
  | "email_opened"
  | "email_clicked"
  | "email_bounced"
  | "upload_failed"
  | "field_error"
  | "send_failed";

export function track(name: AnalyticsEvent, properties?: Record<string, unknown>): void {
  if (!hasAnalyticsConsent()) return;
  if (isExcludeSelf()) return;

  const body = JSON.stringify({
    name,
    properties,
    visitorId: visitorId(),
    path: typeof location !== "undefined" ? location.pathname : undefined,
  });

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([body], { type: "application/json" });
    const ok = navigator.sendBeacon("/api/analytics/track", blob);
    if (ok) return;
  }

  void fetch("/api/analytics/track", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}
