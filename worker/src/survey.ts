import type { Env } from "./types"

/**
 * Anonymous, aggregated-only signal for the "what's stopping you from going
 * Pro?" in-product survey (apps/extension/src/components/SurveyPrompt.tsx).
 * Modeled directly on votes.ts: no per-user identifier, just an enum bump
 * in KV plus a capped rolling log of freetext so Brian can actually read
 * what free users are saying, not just count them.
 */

export const SURVEY_REASON_IDS = [
  "not_sure_what_id_get",
  "too_expensive",
  "not_used_enough",
  "just_browsing",
  "other",
] as const
export type SurveyReasonId = (typeof SURVEY_REASON_IDS)[number]

const COUNTS_KEY = "survey:counts:v1"
const FREETEXT_KEY = "survey:freetext:v1"
const RATE_PREFIX = "survey:rl:"
const MAX_SUBMISSIONS_PER_IP_PER_DAY = 20
const MAX_FREETEXT_ENTRIES = 200
const MAX_FREETEXT_LEN = 500

interface FreetextEntry {
  reason: SurveyReasonId
  text: string
  at: string // ISO timestamp -- enough to spot a spike, not enough to fingerprint a user
}

function emptyCounts(): Record<SurveyReasonId, number> {
  return Object.fromEntries(SURVEY_REASON_IDS.map((id) => [id, 0])) as Record<SurveyReasonId, number>
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

function isReasonId(value: unknown): value is SurveyReasonId {
  return typeof value === "string" && (SURVEY_REASON_IDS as readonly string[]).includes(value)
}

async function readCounts(env: Env): Promise<Record<SurveyReasonId, number>> {
  const raw = await env.RATE_LIMIT_KV.get(COUNTS_KEY)
  const base = emptyCounts()
  if (!raw) return base
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    for (const id of SURVEY_REASON_IDS) {
      const n = parsed[id]
      if (typeof n === "number" && Number.isFinite(n) && n >= 0) base[id] = Math.floor(n)
    }
  } catch {
    return base
  }
  return base
}

async function readFreetext(env: Env): Promise<FreetextEntry[]> {
  const raw = await env.RATE_LIMIT_KV.get(FREETEXT_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e): e is FreetextEntry =>
        !!e && typeof e === "object" && isReasonId((e as FreetextEntry).reason) && typeof (e as FreetextEntry).text === "string"
    )
  } catch {
    return []
  }
}

function utcDay(): string {
  return new Date().toISOString().slice(0, 10)
}

function clientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() || "0.0.0.0"
}

export async function handleSurvey(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin")

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) })
  }

  if (request.method === "GET") {
    const [counts, freetext] = await Promise.all([readCounts(env), readFreetext(env)])
    return json({ counts, freetext }, origin)
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

  const { reason, freetext } = body as Record<string, unknown>
  if (!isReasonId(reason)) {
    return json({ error: "INVALID_REQUEST" }, origin, 400)
  }
  if (freetext !== undefined && typeof freetext !== "string") {
    return json({ error: "INVALID_REQUEST" }, origin, 400)
  }

  const ip = clientIp(request)
  const rlKey = `${RATE_PREFIX}${utcDay()}:${ip}`
  const used = Number.parseInt((await env.RATE_LIMIT_KV.get(rlKey)) || "0", 10) || 0
  if (used >= MAX_SUBMISSIONS_PER_IP_PER_DAY) {
    return json({ error: "RATE_LIMITED" }, origin, 429)
  }
  await env.RATE_LIMIT_KV.put(rlKey, String(used + 1), { expirationTtl: 172800 })

  const counts = await readCounts(env)
  counts[reason] += 1
  await env.RATE_LIMIT_KV.put(COUNTS_KEY, JSON.stringify(counts))

  const trimmedFreetext = typeof freetext === "string" ? freetext.trim().slice(0, MAX_FREETEXT_LEN) : ""
  if (trimmedFreetext) {
    const existing = await readFreetext(env)
    const next = [...existing, { reason, text: trimmedFreetext, at: new Date().toISOString() }].slice(
      -MAX_FREETEXT_ENTRIES
    )
    await env.RATE_LIMIT_KV.put(FREETEXT_KEY, JSON.stringify(next))
  }

  return json({ ok: true }, origin)
}
