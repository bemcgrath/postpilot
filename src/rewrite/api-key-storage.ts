const API_KEY_STORAGE_KEY = "postpilot_claude_api_key"

function getStorage(): typeof chrome.storage.local | null {
  try {
    if (
      typeof chrome !== "undefined" &&
      chrome.runtime?.id &&
      typeof chrome.storage !== "undefined" &&
      typeof chrome.storage.local !== "undefined"
    ) {
      return chrome.storage.local
    }
  } catch {}
  return null
}

/** True on unpacked/dev-loaded builds (no update_url in the runtime manifest). */
function isDevBuild(): boolean {
  try {
    return !("update_url" in chrome.runtime.getManifest())
  } catch {
    return false
  }
}

/**
 * On dev/unpacked builds sharing storage with a real install (see the
 * extension-ID-matching setup used for local testing), the key stays hidden
 * unless the dev-Pro toggle is on -- so testing "free" doesn't silently ride
 * on a real paid key. Real (Web Store) builds are unaffected.
 */
export async function getClaudeApiKey(): Promise<string | null> {
  const storage = getStorage()
  if (!storage) return null
  return new Promise((resolve) => {
    storage.get([API_KEY_STORAGE_KEY, "postpilot_dev_pro"], (result) => {
      if (isDevBuild() && result.postpilot_dev_pro !== true) {
        resolve(null)
        return
      }
      resolve((result[API_KEY_STORAGE_KEY] as string) || null)
    })
  })
}

export async function setClaudeApiKey(key: string): Promise<void> {
  const storage = getStorage()
  if (!storage) return
  return new Promise((resolve) => {
    storage.set({ [API_KEY_STORAGE_KEY]: key }, resolve)
  })
}

export async function clearClaudeApiKey(): Promise<void> {
  const storage = getStorage()
  if (!storage) return
  return new Promise((resolve) => {
    storage.remove(API_KEY_STORAGE_KEY, resolve)
  })
}
