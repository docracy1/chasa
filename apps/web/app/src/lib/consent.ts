const CONSENT_KEY = "docstoc_cookie_consent";
const LEGACY_CONSENT_KEY = "chasa_cookie_consent";

function readConsent(): string | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    if (v) return v;
    const legacy = localStorage.getItem(LEGACY_CONSENT_KEY);
    if (legacy) {
      localStorage.setItem(CONSENT_KEY, legacy);
      localStorage.removeItem(LEGACY_CONSENT_KEY);
      return legacy;
    }
    return null;
  } catch {
    return null;
  }
}

export function hasAnalyticsConsent(): boolean {
  return readConsent() === "accepted";
}

export function setAnalyticsConsent(value: "accepted" | "declined"): void {
  try {
    localStorage.setItem(CONSENT_KEY, value);
    localStorage.removeItem(LEGACY_CONSENT_KEY);
  } catch {
    /* ignore */
  }
}

export function consentPending(): boolean {
  return readConsent() === null;
}
