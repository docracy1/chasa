const PROJECT_ID = "xtl7mhg00w";
const EXCLUDE_KEY = "docstoc_exclude_self";

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void;
    docstocLoadClarity?: () => void;
  }
}

function excludeSelf(): boolean {
  try {
    return localStorage.getItem(EXCLUDE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Load Microsoft Clarity after analytics consent. Safe to call repeatedly. */
export function loadClarity(): void {
  if (excludeSelf()) return;
  if (typeof window.docstocLoadClarity === "function") {
    window.docstocLoadClarity();
    return;
  }
  if (document.querySelector('script[data-docstoc-clarity]')) return;
  if (typeof window.clarity === "function") return;

  const w = window as Window & { clarity?: ((...args: unknown[]) => void) & { q?: unknown[][] } };
  w.clarity =
    w.clarity ||
    function (...args: unknown[]) {
      (w.clarity!.q = w.clarity!.q || []).push(args);
    };
  const t = document.createElement("script");
  t.async = true;
  t.src = `https://www.clarity.ms/tag/${PROJECT_ID}`;
  t.setAttribute("data-docstoc-clarity", "1");
  const first = document.getElementsByTagName("script")[0];
  first?.parentNode?.insertBefore(t, first);
}
