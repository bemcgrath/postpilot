/**
 * LemonSqueezy license validation for PostPilot Pro.
 *
 * License key and instance ID are stored in chrome.storage.local separately
 * from the main config so they survive config imports/resets.
 */

import { getStore, uuid } from "@postpilot/core/storage/adapter"

const LS_LICENSE_KEY = "postpilot_license_key"
const LS_INSTANCE_ID = "postpilot_instance_id"
const LS_CACHE_ACTIVE = "postpilot_license_cache_active"
const LS_CACHE_CHECKED_AT = "postpilot_license_cache_checked_at"

const ACTIVATE_URL = "https://api.lemonsqueezy.com/v1/licenses/activate"
const VALIDATE_URL  = "https://api.lemonsqueezy.com/v1/licenses/validate"

// PostPilotPanel mounts a fresh instance for every compose box, so a naive
// "validate on every mount" check can hit LemonSqueezy dozens of times per
// session. Cache the result so real network validation only happens this
// often; in between, trust the last known-good answer.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000

interface CacheEntry {
  active: boolean
  checkedAt: number
}

async function readCache(): Promise<CacheEntry | null> {
  const storage = getStore()
  if (!storage) return null
  const result = await storage.get([LS_CACHE_ACTIVE, LS_CACHE_CHECKED_AT])
  const checkedAt = result[LS_CACHE_CHECKED_AT]
  if (typeof checkedAt !== "number") return null
  return { active: result[LS_CACHE_ACTIVE] === true, checkedAt }
}

async function writeCache(active: boolean): Promise<void> {
  const storage = getStore()
  if (!storage) return
  await storage.set({ [LS_CACHE_ACTIVE]: active, [LS_CACHE_CHECKED_AT]: Date.now() })
}

async function clearCache(): Promise<void> {
  const storage = getStore()
  if (!storage) return
  await storage.remove([LS_CACHE_ACTIVE, LS_CACHE_CHECKED_AT])
}

export interface LicenseStatus {
  isActive: boolean
  licenseKey: string | null
  instanceId: string | null
  error: string | null
}

async function storageGet(keys: string[]): Promise<Record<string, string | null>> {
  const storage = getStore()
  if (!storage) return Object.fromEntries(keys.map((k) => [k, null]))
  const result = await storage.get(keys)
  return result as Record<string, string | null>
}

async function storageSet(items: Record<string, string | null>): Promise<void> {
  const storage = getStore()
  if (!storage) return
  await storage.set(items)
}

async function storageRemove(keys: string[]): Promise<void> {
  const storage = getStore()
  if (!storage) return
  await storage.remove(keys)
}

/** Load the current license status from local storage (no network call). */
export async function loadLicenseStatus(): Promise<LicenseStatus> {
  const data = await storageGet([LS_LICENSE_KEY, LS_INSTANCE_ID])
  const licenseKey = data[LS_LICENSE_KEY] ?? null
  const instanceId = data[LS_INSTANCE_ID] ?? null
  return { isActive: !!(licenseKey && instanceId), licenseKey, instanceId, error: null }
}

/** Activate a license key against LemonSqueezy. Stores result on success. */
export async function activateLicense(key: string): Promise<LicenseStatus> {
  const trimmed = key.trim()
  if (!trimmed) {
    return { isActive: false, licenseKey: null, instanceId: null, error: "Please enter a license key." }
  }

  const instanceId = uuid()

  try {
    const res = await fetch(ACTIVATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ license_key: trimmed, instance_name: "PostPilot" }),
    })
    const data = await res.json()

    if (data.activated) {
      await storageSet({ [LS_LICENSE_KEY]: trimmed, [LS_INSTANCE_ID]: data.instance?.id ?? instanceId })
      return { isActive: true, licenseKey: trimmed, instanceId: data.instance?.id ?? instanceId, error: null }
    }

    const msg = data.error ?? "Invalid license key. Check your purchase email and try again."
    return { isActive: false, licenseKey: null, instanceId: null, error: msg }
  } catch {
    return { isActive: false, licenseKey: null, instanceId: null, error: "Network error — check your connection and try again." }
  }
}

/** Validate an already-activated license (lightweight check on startup). */
export async function validateStoredLicense(): Promise<LicenseStatus> {
  const stored = await loadLicenseStatus()
  if (!stored.isActive || !stored.licenseKey || !stored.instanceId) {
    return { isActive: false, licenseKey: null, instanceId: null, error: null }
  }

  // Trust a recent result instead of re-hitting the network on every mount —
  // this is what makes a single transient failure survivable instead of
  // something every compose box independently races against.
  const cached = await readCache()
  if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
    return { ...stored, isActive: cached.active }
  }

  try {
    const res = await fetch(VALIDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ license_key: stored.licenseKey, instance_id: stored.instanceId }),
    })
    const data = await res.json()
    if (data.valid) {
      await writeCache(true)
      return stored
    }
    // Don't destroy locally stored credentials on a single "invalid" response —
    // a transient LemonSqueezy hiccup or instance-ID race would otherwise
    // permanently downgrade a paying subscriber with no recovery path. Mark
    // this window inactive; the license key stays in storage so the next
    // check can self-heal if it really was just a blip.
    await writeCache(false)
    return {
      isActive: false,
      licenseKey: stored.licenseKey,
      instanceId: stored.instanceId,
      error: "License check failed — retrying automatically.",
    }
  } catch {
    // Network failure — assume still active (don't lock out offline users)
    return stored
  }
}

/** Remove stored license (deactivate locally). */
export async function deactivateLicense(): Promise<void> {
  await storageRemove([LS_LICENSE_KEY, LS_INSTANCE_ID])
  await clearCache()
}
