import { useState } from "react";
import { consentPending, hasAnalyticsConsent, setAnalyticsConsent } from "../lib/consent";

export default function AppConsentBanner() {
  const [hidden, setHidden] = useState(() => !consentPending() || hasAnalyticsConsent());

  if (hidden) return null;

  return (
    <div
      className="chasa-app-consent"
      role="dialog"
      aria-modal="true"
      aria-label="Cookie consent"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        padding: "14px 18px",
        background: "var(--ink, #1a1a1a)",
        color: "#fff",
        boxShadow: "0 -4px 24px rgba(0,0,0,.18)",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <p style={{ margin: 0, flex: 1, fontSize: 14, lineHeight: 1.5 }}>
          We use cookies for anonymous analytics. See our{" "}
          <a href="/privacy" style={{ color: "var(--accent, #c45c26)" }}>
            Privacy policy
          </a>
          .
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setAnalyticsConsent("declined");
              setHidden(true);
            }}
          >
            Decline
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setAnalyticsConsent("accepted");
              setHidden(true);
            }}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
