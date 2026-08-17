import { dailyCapFor, identityKey, resolveTier } from "./entitlement"
import { checkAndIncrement, decrement } from "./rateLimit"
import { callAnthropic } from "./anthropic"
import { buildSystemPrompt, buildUserContent, parseRewrites } from "./prompt"
import type { Env, RewriteRequestBody } from "./types"

const CLIENT_KEY_HEADER = "X-PostPilot-Key"

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function isAuthorized(request: Request, env: Env): boolean {
  const expected = env.REWRITE_CLIENT_SECRET
  // Secret is not set on this worker yet. Fail *open* so a missing secret
  // cannot take down rewrites. Once `wrangler secret put REWRITE_CLIENT_SECRET`
  // matches the extension's PLASMO_PUBLIC_REWRITE_KEY, this branch stops
  // running and the header is required.
  if (!expected) {
    console.warn("[postpilot-rewrite-worker] REWRITE_CLIENT_SECRET unset; allowing request")
    return true
  }
  return request.headers.get(CLIENT_KEY_HEADER) === expected
}

function isValidIdentity(identity: unknown): identity is RewriteRequestBody["identity"] {
  if (!identity || typeof identity !== "object") return false
  const i = identity as Record<string, unknown>
  if (i.type === "license") return typeof i.licenseKey === "string" && typeof i.instanceId === "string"
  if (i.type === "device") return typeof i.deviceId === "string"
  return false
}

function isValidBody(body: unknown): body is RewriteRequestBody {
  if (!body || typeof body !== "object") return false
  const b = body as Record<string, unknown>
  return (
    isValidIdentity(b.identity) &&
    typeof b.originalText === "string" &&
    b.originalText.length > 0 &&
    b.originalText.length <= 4000 && // generous ceiling -- X posts/replies are short; guards against abuse payloads
    typeof b.isReply === "boolean" &&
    typeof b.hookInfo === "string" &&
    typeof b.governorLines === "string" &&
    typeof b.suggestionLines === "string" &&
    (b.count === 1 || b.count === 3)
  )
}

export async function handleRewrite(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) {
    return json({ error: "UNAUTHORIZED" }, 401)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: "INVALID_JSON" }, 400)
  }

  if (!isValidBody(body)) {
    return json({ error: "INVALID_REQUEST" }, 400)
  }

  const tier = await resolveTier(env, body.identity)

  // Server owns variant count. A Free identity can't claim 3, and a Pro
  // identity always gets 3 even if the client UI thought it was Free.
  const count = tier === "pro" ? 3 : 1
  const voiceDigest = tier === "pro" ? body.voiceDigest : undefined

  const cap = dailyCapFor(env, tier)
  const idKey = identityKey(body.identity)
  const rateLimit = await checkAndIncrement(env, idKey, cap)
  if (!rateLimit.allowed) {
    return json(
      { error: "QUOTA_EXCEEDED", resetsAt: rateLimit.resetsAt, remaining: 0, tier },
      429
    )
  }

  try {
    const system = buildSystemPrompt(count)
    const userContent = buildUserContent({ ...body, count, voiceDigest })
    const responseText = await callAnthropic(env, system, userContent)
    // The prompt asks Claude for exactly `count` rewrites, but nothing
    // guarantees it obeys that -- truncate defensively so callers can rely
    // on the contract rather than the model's compliance.
    const rewrites = parseRewrites(responseText).slice(0, count)
    if (rewrites.length === 0) {
      await decrement(env, idKey)
      return json({ error: "GENERATION_FAILED" }, 502)
    }
    return json({
      rewrites,
      tier,
      remaining: rateLimit.remaining,
      resetsAt: rateLimit.resetsAt,
    })
  } catch (err) {
    await decrement(env, idKey)
    console.error("[postpilot-rewrite-worker] generation failed", err)
    return json({ error: "GENERATION_FAILED" }, 502)
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === "POST" && url.pathname === "/v1/rewrite") {
      return handleRewrite(request, env)
    }

    return json({ error: "NOT_FOUND" }, 404)
  },
}
