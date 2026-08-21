import { DurableObject } from "cloudflare:workers";

const SITE_ORIGIN = "https://hubert-hwk.github.io";
const LOCAL_ORIGIN = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/;
const POST_PATH = /^\/20\d{2}\/\d{2}\/\d{2}\/[a-z0-9-]+\/$/;
const VIEWER_ID = /^[a-zA-Z0-9_-]{16,128}$/;
const MAX_PATHS_PER_REQUEST = 100;
const MAX_HITS_PER_MINUTE = 12;

type ViewResult = { views: number; counted: boolean };
type CounterRow = { views: number };
type RateRow = { bucket: number; hits: number };

export class PageCounter extends DurableObject<Env> {
  private readonly sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(
      `CREATE TABLE IF NOT EXISTS counters (
        key TEXT PRIMARY KEY,
        views INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS rate_limits (
        viewer_id TEXT PRIMARY KEY,
        bucket INTEGER NOT NULL,
        hits INTEGER NOT NULL
      );`,
    );
  }

  increment(viewerId: string, now: number): ViewResult {
    const bucket = Math.floor(now / 60_000);
    const previous = this.sql
      .exec<RateRow>("SELECT bucket, hits FROM rate_limits WHERE viewer_id = ?", viewerId)
      .toArray()[0];

    this.sql.exec("DELETE FROM rate_limits WHERE bucket < ?", bucket - 1);

    let counted = true;
    if (previous?.bucket === bucket && previous.hits >= MAX_HITS_PER_MINUTE) {
      counted = false;
    } else if (previous?.bucket === bucket) {
      this.sql.exec("UPDATE rate_limits SET hits = hits + 1 WHERE viewer_id = ?", viewerId);
    } else {
      this.sql.exec(
        "INSERT INTO rate_limits (viewer_id, bucket, hits) VALUES (?, ?, 1) ON CONFLICT(viewer_id) DO UPDATE SET bucket = excluded.bucket, hits = 1",
        viewerId,
        bucket,
      );
    }

    if (counted) {
      this.sql.exec("INSERT INTO counters (key, views) VALUES ('views', 1) ON CONFLICT(key) DO UPDATE SET views = views + 1");
    }

    return { views: this.getCount(), counted };
  }

  getCount(): number {
    const row = this.sql.exec<CounterRow>("SELECT views FROM counters WHERE key = 'views'").toArray()[0];
    return Number(row?.views ?? 0);
  }
}

function isAllowedOrigin(origin: string | null): origin is string {
  return origin === SITE_ORIGIN || (origin !== null && LOCAL_ORIGIN.test(origin));
}

function corsHeaders(origin: string): Headers {
  return new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    Vary: "Origin",
  });
}

function json(data: unknown, status: number, origin: string): Response {
  const headers = corsHeaders(origin);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { status, headers });
}

function validPostPath(path: unknown): path is string {
  return typeof path === "string" && POST_PATH.test(path);
}

function getCounter(env: Env, path: string): DurableObjectStub<PageCounter> {
  return env.PAGE_COUNTERS.getByName(`page:${path}`);
}

async function handleHit(request: Request, env: Env, origin: string): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 1024) return json({ error: "Payload too large" }, 413, origin);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Expected a JSON body" }, 400, origin);
  }

  if (typeof body !== "object" || body === null) return json({ error: "Invalid payload" }, 400, origin);
  const { path, viewerId } = body as Record<string, unknown>;
  if (!validPostPath(path) || typeof viewerId !== "string" || !VIEWER_ID.test(viewerId)) {
    return json({ error: "Invalid post path or viewer id" }, 400, origin);
  }

  const result = await getCounter(env, path).increment(viewerId, Date.now());
  return json({ path, ...result }, 200, origin);
}

async function handleStats(url: URL, env: Env, origin: string): Promise<Response> {
  const paths = [...new Set(url.searchParams.getAll("path").filter(validPostPath))].slice(0, MAX_PATHS_PER_REQUEST);
  if (paths.length === 0) return json({ error: "At least one valid post path is required" }, 400, origin);

  const counts = await Promise.all(paths.map(async (path) => [path, await getCounter(env, path).getCount()] as const));
  const views = Object.fromEntries(counts);
  const total = counts.reduce((sum, [, count]) => sum + count, 0);
  return json({ total, views }, 200, origin);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    if (!isAllowedOrigin(origin)) return new Response("Forbidden", { status: 403 });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });

    const url = new URL(request.url);
    try {
      if (request.method === "POST" && url.pathname === "/v1/hit") return await handleHit(request, env, origin);
      if (request.method === "GET" && url.pathname === "/v1/views") return await handleStats(url, env, origin);
      return json({ error: "Not found" }, 404, origin);
    } catch (error) {
      console.error(JSON.stringify({ event: "view_counter_error", path: url.pathname, error: String(error) }));
      return json({ error: "Counter temporarily unavailable" }, 503, origin);
    }
  },
} satisfies ExportedHandler<Env>;
