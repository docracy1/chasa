import type { ReactNode } from "react";

export function StatusPill({
  kind,
  children,
}: {
  kind: "ok" | "warn" | "muted" | "fail";
  children: ReactNode;
}) {
  return <span className={`connector-pill connector-pill-${kind}`}>{children}</span>;
}
