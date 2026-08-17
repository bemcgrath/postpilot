import type { Env } from "./types"

export const IDEA_IDS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] as const
export type IdeaId = (typeof IDEA_IDS)[number]

const COUNTS_KEY = "vote:counts:v1"
const BALLOT_PREFIX = "vote:ballot:v1:"
const RATE_PREFIX = "vote:rl:"
const MAX_POSTS_PER_IP_PER_DAY = 40
const VOTER_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function emptyCounts(): Record<IdeaId, number> {
  return Object.fromEntries(IDEA_IDS.map((id) => [id, 0])) as Record<IdeaId, number>
}

function isAllowedOrigin(origin: string): boolean {
  if (origin === "https://postpilotforx.com" || origin === "https://www.postpilotforx.com") {
    return true
  }
  try {
    const url = new URL(origin)
    return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")
  } catch {
    return false
  }
}

function corsHeaders(origin: string | null): HeadersInit {
  const allow = origin && isAllowedOrigin(origin) ? origin : "https://postpilotforx.com"
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  }
}

function json(data: unknown, origin: string | null, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders(origin) })
}

function isIdeaId(value: unknown): value is IdeaId {
  return typeof value === "string" && (IDEA_IDS as readonly string[]).includes(value)
}

async function readCounts(env: Env): Promise<Record<IdeaId, number> > {
  const raw = await env.RATE_LIMIT_KV.get(COUNTS_KEY)
  const base = emptyCounts()
  if (!raw) return base
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    for (const id of IDEA_IDS) {
      const n = parsed[id]
      if (typeof n === "number" && Number.isFinite(n) && n >= 0) base[id] = Math.floor(n)
    }
  } catch {
    return base
  }
  return base
}

function utcDay(): string {
  return new Date().toISOString().slice(0, 10)
}

function clientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() || "0.0.0.0"
}

export async function handleVotes(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin")

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) })
  }

  if (request.method === "GET") {
    const counts = await readCounts(env)
    return json({ counts }, origin)
  }

  if (request.method !== "POST") {
    return json({ error: "METHOD_NOT_ALLOWED" }, origin, 405)
  }

  if (origin && !isAllowedOrigin(origin)) {
    return json({ error: "FORBIDDEN" }, origin, 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: "INVALID_JSON" }, origin, 400)
  }
  if (!body || typeof body !== "object") {
    return json({ error: "INVALID_REQUEST" }, origin, 400)
  }

  const { id, voter, action } = body as Record<string, unknown>
  if (!isIdeaId(id) || typeof voter !== "string" || !VOTER_RE.test(voter)) {
    return json({ error: "INVALID_REQUEST" }, origin, 400)
  }
  const op = action === "remove" ? "remove" : "add"

  const ip = clientIp(request)
  const rlKey = `${RATE_PREFIX}${utcDay()}:${ip}`
  const used = Number.parseInt((await env.RATE_LIMIT_KV.get(rlKey)) || "0", 10) || 0
  if (used >= MAX_POSTS_PER_IP_PER_DAY) {
    return json({ error: "RATE_LIMITED" }, origin, 429)
  }
  await env.RATE_LIMIT_KV.put(rlKey, String(used + 1), { expirationTtl: 172800 })

  const ballotKey = `${BALLOT_PREFIX}${id}:${voter}`
  const already = (await env.RATE_LIMIT_KV.get(ballotKey)) === "1"
  const counts = await readCounts(env)

  if (op === "add") {
    if (!already) {
      await env.RATE_LIMIT_KV.put(ballotKey, "1")
      counts[id] += 1
      await env.RATE_LIMIT_KV.put(COUNTS_KEY, JSON.stringify(counts))
    }
  } else if (already) {
    await env.RATE_LIMIT_KV.delete(ballotKey)
    counts[id] = Math.max(0, counts[id] - 1)
    await env.RATE_LIMIT_KV.put(COUNTS_KEY, JSON.stringify(counts))
  }

  return json({ counts, voted: op === "add" }, origin)
}
