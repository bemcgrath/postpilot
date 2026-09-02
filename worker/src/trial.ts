import type { Env } from "./types"

const TRIAL_PREFIX = "trial:"
const TRIAL_TTL_SECONDS = 7 * 24 * 60 * 60 // 7 days. TTL expiry IS trial end -- no cron needed.
const MAX_DEVICE_ID_LEN = 128

// Abuse note (accepted, per pro-activation-spec-2026-08-31.md Change 2):
// device-based trials are gameable by clearing extension storage or
// reinstalling, which mints a fresh device id and thus a fresh trial. At
// n=35 installs / 0 conversions, friction is the bigger risk than abuse --
// revisit if trial-abuse volume actually shows up in usage data.

interface TrialRecord {
  started: number // epoch ms
}

function trialKey(deviceId: string): string {
  return `${TRIAL_PREFIX}${deviceId}`
}

function isValidDeviceId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_DEVICE_ID_LEN
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

interface TrialStatus {
  active: boolean
  started?: number
  expiresAt?: string
  daysLeft?: number
}

function statusFromRecord(record: TrialRecord | null): TrialStatus {
  if (!record) return { active: false }
  const expiresAtMs = record.started + TRIAL_TTL_SECONDS * 1000
  const msLeft = expiresAtMs - Date.now()
  if (msLeft <= 0) return { active: false }
  return {
    active: true,
    started: record.started,
    expiresAt: new Date(expiresAtMs).toISOString(),
    // Round up -- "0 days left" reads as already over, so a trial with any
    // time remaining shows at least 1.
    daysLeft: Math.max(1, Math.ceil(msLeft / (24 * 60 * 60 * 1000))),
  }
}

async function readTrial(env: Env, deviceId: string): Promise<TrialRecord | null> {
  const raw = await env.RATE_LIMIT_KV.get(trialKey(deviceId))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<TrialRecord>
    if (typeof parsed.started !== "number") return null
    return { started: parsed.started }
  } catch {
    return null
  }
}

/** Used by entitlement.ts's resolveTier -- true if this device is mid-trial (KV TTL is the source of truth). */
export async function isOnTrial(env: Env, deviceId: string): Promise<boolean> {
  if (!isValidDeviceId(deviceId)) return false
  const record = await readTrial(env, deviceId)
  return statusFromRecord(record).active
}

/**
 * GET /v1/trial?deviceId=... -- current trial status, for Settings to render
 * "Trial: X days left" without guessing client-side.
 * POST /v1/trial { deviceId } -- start a trial if this device doesn't already
 * have one (idempotent: an existing trial is returned unchanged, never
 * extended, so repeat clicks can't be used to push the expiry out).
 */
export async function handleTrial(request: Request, env: Env): Promise<Response> {
  if (request.method === "GET") {
    const deviceId = new URL(request.url).searchParams.get("deviceId")
    if (!isValidDeviceId(deviceId)) {
      return json({ error: "INVALID_REQUEST" }, 400)
    }
    const record = await readTrial(env, deviceId)
    return json(statusFromRecord(record))
  }

  if (request.method !== "POST") {
    return json({ error: "METHOD_NOT_ALLOWED" }, 405)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: "INVALID_JSON" }, 400)
  }
  if (!body || typeof body !== "object") {
    return json({ error: "INVALID_REQUEST" }, 400)
  }
  const { deviceId } = body as Record<string, unknown>
  if (!isValidDeviceId(deviceId)) {
    return json({ error: "INVALID_REQUEST" }, 400)
  }

  const existing = await readTrial(env, deviceId)
  const existingStatus = statusFromRecord(existing)
  if (existingStatus.active) {
    return json(existingStatus)
  }

  const record: TrialRecord = { started: Date.now() }
  await env.RATE_LIMIT_KV.put(trialKey(deviceId), JSON.stringify(record), {
    expirationTtl: TRIAL_TTL_SECONDS,
  })
  return json(statusFromRecord(record))
}
