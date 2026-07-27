const CONSENT_KEY = "chasa_cookie_consent";

export function hasAnalyticsConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === "accepted";
  } catch {
    return false;
  }
}

export function setAnalyticsConsent(value: "accepted" | "declined"): void {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    /* ignore */
  }
}

export function consentPending(): boolean {
  try {
    return !localStorage.getItem(CONSENT_KEY);
  } catch {
    return true;
  }
}
