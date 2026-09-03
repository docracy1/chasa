import { Hono, type Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import type { Env } from "../types";
import { castRoadmapVote, listRoadmapFeatures } from "../lib/roadmap";

const VOTER_COOKIE_NAME = "docstoc_roadmap_voter";
const VOTER_COOKIE_MAX_AGE_SECONDS = 5 * 365 * 24 * 60 * 60;

/** Server-only anonymous voter id — same idea as the docstoc_notrack opt-out cookie, but
 *  httpOnly since nothing client-side ever needs to read its value, only send it back. */
function voterCookieOptions(env: Env) {
  const isHttps = env.PUBLIC_APP_URL.startsWith("https");
  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: (isHttps ? "None" : "Lax") as "None" | "Lax",
    path: "/",
    maxAge: VOTER_COOKIE_MAX_AGE_SECONDS,
  };
}

function getOrCreateVoterId(c: Context<{ Bindings: Env }>): string {
  const existing = getCookie(c, VOTER_COOKIE_NAME);
  if (existing) return existing;
  const id = crypto.randomUUID();
  setCookie(c, VOTER_COOKIE_NAME, id, voterCookieOptions(c.env));
  return id;
}

// Public — anyone browsing /roadmap, no auth. Mounted at /api/roadmap.
const roadmap = new Hono<{ Bindings: Env }>();

roadmap.get("/", async (c) => {
  const voterId = getCookie(c, VOTER_COOKIE_NAME) ?? null;
  const features = await listRoadmapFeatures(c.env, voterId);
  return c.json({ features });
});

interface VoteBody {
  vote?: string;
}

roadmap.post("/:id/vote", async (c) => {
  let body: VoteBody;
  try {
    body = await c.req.json<VoteBody>();
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }
  if (body.vote !== "yes" && body.vote !== "no") {
    return c.json({ error: 'vote must be "yes" or "no"' }, 400);
  }
  const voterId = getOrCreateVoterId(c);
  const result = await castRoadmapVote(c.env, c.req.param("id"), voterId, body.vote);
  if (!result.ok) return c.json({ error: result.error }, 404);
  return c.json({ ok: true });
});

export default roadmap;
