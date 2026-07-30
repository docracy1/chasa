import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AuthEnv } from "./lib/auth";
import type { Env } from "./types";
import auth from "./routes/auth";
import account from "./routes/account";
import billing from "./routes/billing";
import emails from "./routes/emails";
import analytics from "./routes/analytics";
import admin from "./routes/admin";
import blog from "./routes/blog";
import mcp from "./routes/mcp";
import webhooks from "./routes/webhooks";
import connector from "./routes/connector";
import v1 from "./routes/v1";
import clients from "./routes/clients";
import aging from "./routes/aging";
import chase from "./routes/chase";
import reminders from "./routes/reminders";
import tracking from "./routes/tracking";
import team from "./routes/team";
import cspReport from "./routes/cspReport";
import leads from "./routes/leads";
import { configuredAppOrigin, isAllowedAppOrigin } from "./lib/appUrl";
import { purgeExpiredSessions } from "./lib/sessionCleanup";
import { sendDailyChaseDigests } from "./lib/chaseDigest";

const app = new Hono<AuthEnv>();

app.use(
  "/api/*",
  cors({
    origin: (origin, c) => {
      const primary = configuredAppOrigin(c.env);
      if (!origin) return primary;
      return isAllowedAppOrigin(origin, c.env) ? origin : primary;
    },
    credentials: true,
  })
);

app.route("/api/auth", auth);
app.route("/api/account", account);
app.route("/api/clients", clients);
app.route("/api/aging", aging);
app.route("/api/chase", chase);
app.route("/api/reminders", reminders);
app.route("/api/t", tracking);
app.route("/api/tracking", tracking);
app.route("/api/team", team);
app.route("/api/billing", billing);
app.route("/api/analytics", analytics);
app.route("/api/csp-report", cspReport);
app.route("/api/admin", admin);
app.route("/api/blog", blog);
app.route("/api/leads", leads);
app.route("/api/webhooks", webhooks);
app.route("/api/connector", connector);
app.route("/api/v1", v1);
app.route("/api", emails);

// Public MCP for Claude / ChatGPT / Grok / Perplexity — no auth, draft-only tools
app.route("/mcp", mcp);

app.get("/", (c) => c.text("chasa-worker ok"));

export default {
  fetch: app.fetch.bind(app),
  scheduled: async (event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(
      (async () => {
        await purgeExpiredSessions(env);
        await sendDailyChaseDigests(env);
      })()
    );
  },
};
