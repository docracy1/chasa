import { Hono } from "hono";
import type { AuthEnv } from "../lib/auth";

/** Collect CSP violation reports (Report-Only or enforcing). */
const cspReport = new Hono<AuthEnv>();

cspReport.post("/", async (c) => {
  const body = await c.req.text().catch(() => "");
  if (body.length > 8192) {
    return c.body(null, 204);
  }
  try {
    const parsed = JSON.parse(body) as { "csp-report"?: Record<string, unknown> };
    const report = parsed["csp-report"];
    if (report) {
      console.warn("CSP violation", JSON.stringify(report).slice(0, 2000));
    }
  } catch {
    console.warn("CSP report (unparsed)", body.slice(0, 500));
  }
  return c.body(null, 204);
});

export default cspReport;
