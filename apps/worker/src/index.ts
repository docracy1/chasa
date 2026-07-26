import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AuthEnv } from "./lib/auth";
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

const app = new Hono<AuthEnv>();

app.use(
  "/api/*",
  cors({
    origin: (origin, c) => {
      const primary = c.env.PUBLIC_APP_URL;
      if (!origin) return primary;
      if (origin === primary) return origin;
      if (/^https:\/\/chasa(-[\w-]+)?\.pages\.dev$/.test(origin)) return origin;
      if (origin.startsWith("http://localhost:")) return origin;
      return primary;
    },
    credentials: true,
  })
);

app.route("/api/auth", auth);
app.route("/api/account", account);
app.route("/api/billing", billing);
app.route("/api/analytics", analytics);
app.route("/api/admin", admin);
app.route("/api/blog", blog);
app.route("/api/webhooks", webhooks);
app.route("/api/connector", connector);
app.route("/api/v1", v1);
app.route("/api", emails);

// Public MCP for Claude / ChatGPT / Grok / Perplexity — no auth, draft-only tools
app.route("/mcp", mcp);

app.get("/", (c) => c.text("chasa-worker ok"));

export default app;
