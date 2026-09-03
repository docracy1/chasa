import { hasAnalyticsConsent } from "./consent";
import { track, captureAttributionOnce } from "./analytics";

const REFERRAL_KEY = "docstoc_ref_tracked";

/** Once per session — records utm/ref for Admin campaign + external source tiles (Docracy parity). */
export function detectReferralOnce(): void {
  if (!hasAnalyticsConsent()) return;
  try {
    if (sessionStorage.getItem(REFERRAL_KEY)) return;
    sessionStorage.setItem(REFERRAL_KEY, "1");
  } catch {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const utm = params.get("utm_source");
  const refParam = params.get("ref") || params.get("who");
  const ref = document.referrer || "";
  const lower = ref.toLowerCase();
  let source = "direct";
  if (utm) source = utm.toLowerCase();
  else if (refParam) source = String(refParam).toLowerCase().slice(0, 64);
  else if (lower.includes("linkedin.com")) source = "linkedin";
  else if (lower.includes("google.")) source = "google";
  else if (ref && !lower.includes(location.host)) source = "referral";
  else if (ref) source = "internal";

  // First-touch wins — captureAttributionOnce no-ops if a value is already stored, so a later
  // session's direct/internal visit never overwrites the campaign that originally brought them in.
  const utmCampaign = params.get("utm_campaign");
  if (utm) captureAttributionOnce(utmCampaign ? `${utm.toLowerCase()}/${utmCampaign.toLowerCase()}` : utm.toLowerCase());
  else if (refParam) captureAttributionOnce(String(refParam).toLowerCase());

  track("referral_source_detected", {
    source,
    referrer: ref ? ref.slice(0, 200) : undefined,
    utm_source: utm || undefined,
    utm_medium: params.get("utm_medium") || undefined,
    utm_campaign: params.get("utm_campaign") || undefined,
    ref: refParam || undefined,
    who: params.get("who") || undefined,
  });
}
