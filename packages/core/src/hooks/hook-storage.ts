import { getStore } from "../storage/adapter"

const HOOK_KEY = "postpilot_hook_library"
const MAX_HOOKS = 50

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
  const storage = getStore()
  if (!storage) return []
  const result = await storage.get(HOOK_KEY)
  return (result[HOOK_KEY] as HookEntry[]) ?? []
}

export async function saveHook(
  fullText: string,
  hookType: string | null,
  score: number,
  source: "auto" | "manual"
): Promise<HookEntry> {
  const storage = getStore()
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
    await storage.set({ [HOOK_KEY]: updated })
    return refreshed
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
  await storage.set({ [HOOK_KEY]: updated })
  return entry
}

export async function deleteHook(id: string): Promise<void> {
  const storage = getStore()
  if (!storage) return
  const existing = await loadHooks()
  await storage.set({ [HOOK_KEY]: existing.filter((h) => h.id !== id) })
}
