/**
 * Anonymous per-install identifier used to key Free-tier AI Rewrite quota on
 * the backend (worker/). Not an account -- just enough for the server to
 * tell "same install asking again" from "a different install", so the Free
 * daily cap can't be reset by uninstall/reinstall alone. No PII, never sent
 * anywhere except PostPilot's own rewrite worker.
 */
const DEVICE_ID_KEY = "postpilot_device_id"

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

export async function getOrCreateDeviceId(): Promise<string> {
  const storage = getStorage()
  if (!storage) return crypto.randomUUID() // no persistence available -- caller still gets a usable id for this call

  const existing = await new Promise<string | undefined>((resolve) => {
    storage.get(DEVICE_ID_KEY, (result) => resolve(result[DEVICE_ID_KEY] as string | undefined))
  })
  if (existing) return existing

  const id = crypto.randomUUID()
  await new Promise<void>((resolve) => storage.set({ [DEVICE_ID_KEY]: id }, resolve))
  return id
}
