import type { Env } from "./types"

// KV counters are keyed by UTC calendar day and reset at UTC midnight. A
// rolling 24h window would be more precise but harder to explain to users
// ("resets at midnight UTC" is a message the extension can render directly).
const COUNTER_TTL_SECONDS = 25 * 60 * 60 // outlives the day it belongs to, then expires on its own

function utcDateBucket(now: Date): string {
  return now.toISOString().slice(0, 10) // YYYY-MM-DD
}

function nextUtcMidnight(now: Date): Date {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0))
  return next
}

function counterKey(identityKey: string, bucket: string): string {
  return `ratelimit:${identityKey}:${bucket}`
}

export interface RateLimitResult {
  allowed: boolean
  resetsAt: string // ISO timestamp
}

/**
 * Checks the caller's usage against `cap` for the current UTC day and, if
 * allowed, increments the counter. KV is eventually consistent -- a caller
 * issuing many requests in a tight burst could theoretically slip a couple
 * over the cap before a write propagates. Acceptable for a daily cap sized
 * to protect against runaway cost, not to enforce an exact ceiling; if this
 * gets gamed at real volume, this one key is the spot to move to a Durable
 * Object for atomic increments.
 */
export async function checkAndIncrement(env: Env, identityKey: string, cap: number): Promise<RateLimitResult> {
  const now = new Date()
  const bucket = utcDateBucket(now)
  const key = counterKey(identityKey, bucket)
  const resetsAt = nextUtcMidnight(now).toISOString()

  const raw = await env.RATE_LIMIT_KV.get(key)
  const current = raw ? Number.parseInt(raw, 10) : 0

  if (current >= cap) {
    return { allowed: false, resetsAt }
  }

  await env.RATE_LIMIT_KV.put(key, String(current + 1), { expirationTtl: COUNTER_TTL_SECONDS })
  return { allowed: true, resetsAt }
}
