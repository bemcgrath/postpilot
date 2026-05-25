/**
 * LemonSqueezy license validation for PostPilot Pro.
 *
 * License key and instance ID are stored in chrome.storage.local separately
 * from the main config so they survive config imports/resets.
 */

const LS_LICENSE_KEY = "postpilot_license_key"
const LS_INSTANCE_ID = "postpilot_instance_id"

const ACTIVATE_URL = "https://api.lemonsqueezy.com/v1/licenses/activate"
const VALIDATE_URL  = "https://api.lemonsqueezy.com/v1/licenses/validate"

export interface LicenseStatus {
  isActive: boolean
  licenseKey: string | null
  instanceId: string | null
  error: string | null
}

function getStorage(): typeof chrome.storage.local | null {
  try {
    if (typeof chrome !== "undefined" && chrome.runtime?.id && chrome.storage?.local) {
      return chrome.storage.local
    }
  } catch {}
  return null
}

async function storageGet(keys: string[]): Promise<Record<string, string | null>> {
  const storage = getStorage()
  if (!storage) return Object.fromEntries(keys.map((k) => [k, null]))
  return new Promise((resolve) => {
    storage.get(keys, (result) => resolve(result as Record<string, string | null>))
  })
}

async function storageSet(items: Record<string, string | null>): Promise<void> {
  const storage = getStorage()
  if (!storage) return
  return new Promise((resolve) => storage.set(items, resolve))
}

async function storageRemove(keys: string[]): Promise<void> {
  const storage = getStorage()
  if (!storage) return
  return new Promise((resolve) => storage.remove(keys, resolve))
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

  const instanceId = crypto.randomUUID()

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

  try {
    const res = await fetch(VALIDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ license_key: stored.licenseKey, instance_id: stored.instanceId }),
    })
    const data = await res.json()
    if (data.valid) return stored
    // Key revoked — clear stored data
    await storageRemove([LS_LICENSE_KEY, LS_INSTANCE_ID])
    return { isActive: false, licenseKey: null, instanceId: null, error: "License no longer valid." }
  } catch {
    // Network failure — assume still active (don't lock out offline users)
    return stored
  }
}

/** Remove stored license (deactivate locally). */
export async function deactivateLicense(): Promise<void> {
  await storageRemove([LS_LICENSE_KEY, LS_INSTANCE_ID])
}
