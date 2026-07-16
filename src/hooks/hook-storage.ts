const HOOK_KEY = "postpilot_hook_library"
const MAX_HOOKS = 50

function getStorage(): typeof chrome.storage.local | null {
  try {
    if (
      typeof chrome !== "undefined" &&
      chrome.runtime?.id &&
      typeof chrome.storage !== "undefined"
    ) {
      return chrome.storage.local
    }
  } catch {}
  return null
}

export interface HookEntry {
  id: string
  hook: string
  fullText: string
  hookType: string | null
  score: number
  savedAt: number
  source: "auto" | "manual"
}

function firstLine(text: string): string {
  const line = text.split(/\n/)[0].trim()
  return line.length > 120 ? line.slice(0, 120) + "…" : line
}

export async function loadHooks(): Promise<HookEntry[]> {
  const storage = getStorage()
  if (!storage) return []
  return new Promise((resolve) => {
    storage.get(HOOK_KEY, (result) => {
      resolve((result[HOOK_KEY] as HookEntry[]) ?? [])
    })
  })
}

export async function saveHook(
  fullText: string,
  hookType: string | null,
  score: number,
  source: "auto" | "manual"
): Promise<HookEntry> {
  const storage = getStorage()
  const existing = storage ? await loadHooks() : []

  // Re-saving the same text (e.g. reusing a hook via "Use", then posting it)
  // refreshes the existing entry instead of adding a duplicate.
  const trimmed = fullText.trim()
  const dup = existing.find((h) => h.fullText.trim() === trimmed)
  if (dup && storage) {
    const refreshed: HookEntry = {
      ...dup,
      hookType: hookType ?? dup.hookType,
      score,
      savedAt: Date.now(),
      source,
    }
    const updated = [refreshed, ...existing.filter((h) => h.id !== dup.id)]
    return new Promise((resolve) => {
      storage.set({ [HOOK_KEY]: updated }, () => resolve(refreshed))
    })
  }

  const entry: HookEntry = {
    id: `hook_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    hook: firstLine(fullText),
    fullText,
    hookType,
    score,
    savedAt: Date.now(),
    source,
  }
  if (!storage) return entry
  const updated = [entry, ...existing].slice(0, MAX_HOOKS)
  return new Promise((resolve) => {
    storage.set({ [HOOK_KEY]: updated }, () => resolve(entry))
  })
}

export async function deleteHook(id: string): Promise<void> {
  const storage = getStorage()
  if (!storage) return
  const existing = await loadHooks()
  return new Promise((resolve) => {
    storage.set({ [HOOK_KEY]: existing.filter((h) => h.id !== id) }, resolve)
  })
}
