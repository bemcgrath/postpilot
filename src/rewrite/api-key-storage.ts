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

export async function getClaudeApiKey(): Promise<string | null> {
  const storage = getStorage()
  if (!storage) return null
  return new Promise((resolve) => {
    storage.get(API_KEY_STORAGE_KEY, (result) => {
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
