import { dailyCapFor, identityKey, resolveTier } from "./entitlement"
import { checkAndIncrement } from "./rateLimit"
import { callAnthropic } from "./anthropic"
import { buildSystemPrompt, buildUserContent, parseRewrites } from "./prompt"
import type { Env, RewriteRequestBody } from "./types"

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
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

  // A Free identity can't claim a 3-variant Pro request or attach a voice
  // digest -- both are gated server-side regardless of what the client sent.
  const count = tier === "pro" ? body.count : 1
  const voiceDigest = tier === "pro" ? body.voiceDigest : undefined

  const cap = dailyCapFor(env, tier)
  const idKey = identityKey(body.identity)
  const rateLimit = await checkAndIncrement(env, idKey, cap)
  if (!rateLimit.allowed) {
    return json({ error: "QUOTA_EXCEEDED", resetsAt: rateLimit.resetsAt }, 429)
  }

  try {
    const system = buildSystemPrompt(count)
    const userContent = buildUserContent({ ...body, count, voiceDigest })
    const responseText = await callAnthropic(env, system, userContent)
    const rewrites = parseRewrites(responseText)
    return json({ rewrites })
  } catch (err) {
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
