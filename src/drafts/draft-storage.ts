const DRAFTS_KEY = "postpilot_drafts"
const MAX_DRAFTS = 20

export interface DraftEntry {
  id: string
  text: string
  score: number
  hookType: string | null
  savedAt: number
}

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

export async function loadDrafts(): Promise<DraftEntry[]> {
  const storage = getStorage()
  if (!storage) return []
  return new Promise((resolve) => {
    storage.get(DRAFTS_KEY, (result) => {
      resolve((result[DRAFTS_KEY] as DraftEntry[]) ?? [])
    })
  })
}

async function writeDrafts(drafts: DraftEntry[]): Promise<void> {
  const storage = getStorage()
  if (!storage) return
  return new Promise((resolve) => {
    storage.set({ [DRAFTS_KEY]: drafts }, resolve)
  })
}

export async function saveDraft(
  text: string,
  score: number,
  hookType: string | null
): Promise<DraftEntry> {
  const existing = await loadDrafts()
  const entry: DraftEntry = {
    id: crypto.randomUUID(),
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
