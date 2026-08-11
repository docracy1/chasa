import { useEffect, useRef, useState } from "react";
import { useT } from "../lib/i18n";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          appearance?: "always" | "execute" | "interaction-only";
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type AuthConfig = {
  turnstileSiteKey: string | null;
  turnstileRequired: boolean;
};

let configPromise: Promise<AuthConfig> | null = null;

function loadAuthConfig(): Promise<AuthConfig> {
  if (!configPromise) {
    configPromise = fetch("/api/auth/config")
      .then((r) => r.json())
      .then((data) => ({
        turnstileSiteKey:
          typeof (data as AuthConfig).turnstileSiteKey === "string"
            ? (data as AuthConfig).turnstileSiteKey
            : null,
        turnstileRequired: Boolean((data as AuthConfig).turnstileRequired),
      }))
      .catch(() => ({ turnstileSiteKey: null, turnstileRequired: false }));
  }
  return configPromise;
}

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  const existing = document.getElementById(SCRIPT_ID);
  if (existing) {
    return new Promise((resolve) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      if (window.turnstile) resolve();
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Turnstile"));
    document.head.appendChild(script);
  });
}

type Props = {
  onToken: (token: string | null) => void;
};

/**
 * Renders Cloudflare Turnstile when a site key is configured.
 * When keys are absent (local/dev bypass), renders nothing and reports token null.
 */
export default function TurnstileWidget({ onToken }: Props) {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;
  const [siteKey, setSiteKey] = useState<string | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [challengeError, setChallengeError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadAuthConfig().then((cfg) => {
      if (!cancelled) setSiteKey(cfg.turnstileSiteKey);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!siteKey || !containerRef.current) {
      if (siteKey === null) onTokenRef.current(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        await loadTurnstileScript();
        if (cancelled || !containerRef.current || !window.turnstile) return;
        if (widgetIdRef.current) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
        containerRef.current.innerHTML = "";
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: "light",
          // Stays invisible for the vast majority of real visitors — only shows an interactive
          // challenge when Turnstile can't otherwise confirm they're human. Cuts visible friction
          // on the outreach one-click signup path without weakening the check itself.
          appearance: "interaction-only",
          callback: (token) => {
            setChallengeError(false);
            onTokenRef.current(token);
          },
          "expired-callback": () => onTokenRef.current(null),
          // Ad blockers / corporate proxies can silently break the challenge after the script
          // itself loads fine — that used to leave the submit button dead with zero explanation.
          "error-callback": () => {
            onTokenRef.current(null);
            if (!cancelled) setChallengeError(true);
          },
        });
      } catch {
        if (!cancelled) setLoadError(t("turnstile.failed"));
      }
    })();

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* ignore */
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, attempt]);

  if (siteKey === undefined) return null;
  if (!siteKey) return null;

  return (
    <div className="turnstile-wrap">
      <div ref={containerRef} />
      {loadError && <div className="error-msg">{loadError}</div>}
      {challengeError && !loadError && (
        <div className="error-msg">
          {t("turnstile.errorRetry")}{" "}
          <button
            type="button"
            className="turnstile-retry-link"
            onClick={() => {
              setChallengeError(false);
              setAttempt((n) => n + 1);
            }}
          >
            {t("turnstile.retry")}
          </button>
        </div>
      )}
    </div>
  );
}

/** Reset the widget after a failed submit so the user can retry. */
export function resetTurnstile() {
  if (window.turnstile) {
    try {
      window.turnstile.reset();
    } catch {
      /* ignore */
    }
  }
}
