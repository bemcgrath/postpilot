import { getStore, uuid } from "@postpilot/core/storage/adapter"

const DRAFTS_KEY = "postpilot_drafts"
const MAX_DRAFTS = 20

export interface DraftEntry {
  id: string
  text: string
  score: number
  hookType: string | null
  savedAt: number
}

export async function loadDrafts(): Promise<DraftEntry[]> {
  const storage = getStore()
  if (!storage) return []
  const result = await storage.get(DRAFTS_KEY)
  return (result[DRAFTS_KEY] as DraftEntry[]) ?? []
}

async function writeDrafts(drafts: DraftEntry[]): Promise<void> {
  const storage = getStore()
  if (!storage) return
  await storage.set({ [DRAFTS_KEY]: drafts })
}

export async function saveDraft(
  text: string,
  score: number,
  hookType: string | null
): Promise<DraftEntry> {
  const existing = await loadDrafts()
  const entry: DraftEntry = {
    id: uuid(),
    text,
    score,
    hookType,
    savedAt: Date.now(),
  }
  // Prepend new draft, evict oldest if over cap
  const updated = [entry, ...existing].slice(0, MAX_DRAFTS)
  await writeDrafts(updated)
  return entry
}

export async function deleteDraft(id: string): Promise<void> {
  const existing = await loadDrafts()
  await writeDrafts(existing.filter((d) => d.id !== id))
}
