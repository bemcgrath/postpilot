import type { Env, Identity, Tier } from "./types"

const VALIDATE_URL = "https://api.lemonsqueezy.com/v1/licenses/validate"

// Same class of bug PostPilot already shipped once (see PRODUCT.md: a live
// monetization bypass in 0.6.17) -- never trust a client-supplied "I'm Pro"
// claim. This module is the one place that decides tier, and it always goes
// back to LemonSqueezy to do it.

// Cache a validated license's result briefly so a burst of rewrite requests
// from one user doesn't hammer LemonSqueezy on every call. Short enough that
// a cancelled subscription is noticed quickly.
const ENTITLEMENT_CACHE_TTL_SECONDS = 15 * 60

interface CachedEntitlement {
  valid: boolean
  cachedAt: number
}

function cacheKey(licenseKey: string, instanceId: string): string {
  return `entitlement:${licenseKey}:${instanceId}`
}

async function readCachedEntitlement(env: Env, licenseKey: string, instanceId: string): Promise<boolean | null> {
  const raw = await env.RATE_LIMIT_KV.get(cacheKey(licenseKey, instanceId))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as CachedEntitlement
    return parsed.valid
  } catch {
    return null
  }
}

async function writeCachedEntitlement(env: Env, licenseKey: string, instanceId: string, valid: boolean): Promise<void> {
  const entry: CachedEntitlement = { valid, cachedAt: Date.now() }
  await env.RATE_LIMIT_KV.put(cacheKey(licenseKey, instanceId), JSON.stringify(entry), {
    expirationTtl: ENTITLEMENT_CACHE_TTL_SECONDS,
  })
}

/**
 * Resolve the caller's tier. For a `license` identity, this independently
 * re-validates against LemonSqueezy (with a short KV cache) -- it never
 * trusts anything the client asserted about its own Pro status. For a
 * `device` identity there's nothing to validate; it's always Free.
 */
export async function resolveTier(env: Env, identity: Identity): Promise<Tier> {
  if (identity.type === "device") return "free"

  const { licenseKey, instanceId } = identity
  if (!licenseKey || !instanceId) return "free"

  const cached = await readCachedEntitlement(env, licenseKey, instanceId)
  if (cached !== null) return cached ? "pro" : "free"

  try {
    const res = await fetch(VALIDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ license_key: licenseKey, instance_id: instanceId }),
    })
    const data = (await res.json()) as { valid?: boolean }
    const valid = data.valid === true
    await writeCachedEntitlement(env, licenseKey, instanceId, valid)
    return valid ? "pro" : "free"
  } catch {
    // LemonSqueezy unreachable -- fail closed to Free rather than granting
    // Pro quota on an unverifiable claim. Free's cap still lets the request
    // through, it just doesn't get Pro's higher cap or voice digest.
    return "free"
  }
}

export function dailyCapFor(env: Env, tier: Tier): number {
  const raw = tier === "pro" ? env.PRO_DAILY_CAP : env.FREE_DAILY_CAP
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : tier === "pro" ? 40 : 3
}

/**
 * Stable per-user key for rate limiting: license key for Pro (survives
 * reinstalls/browsers), device id for Free.
 */
export function identityKey(identity: Identity): string {
  return identity.type === "license" ? `license:${identity.licenseKey}` : `device:${identity.deviceId}`
}
