const HISTORY_KEY = "postpilot_score_history"
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000

export interface ScoreEntry {
  score: number
  timestamp: number
}

export interface WeekStats {
  thisWeekAvg: number | null
  lastWeekAvg: number | null
  thisWeekCount: number
  totalCount: number
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

export async function loadScoreHistory(): Promise<ScoreEntry[]> {
  const storage = getStorage()
  if (!storage) return []
  return new Promise((resolve) => {
    storage.get(HISTORY_KEY, (result) => {
      resolve((result[HISTORY_KEY] as ScoreEntry[]) ?? [])
    })
  })
}

export async function saveScoreEntry(score: number): Promise<void> {
  const storage = getStorage()
  if (!storage) return

  const now = Date.now()
  const existing = await loadScoreHistory()

  // Prune entries older than 90 days and append new entry
  const pruned = existing.filter((e) => now - e.timestamp < MAX_AGE_MS)
  pruned.push({ score, timestamp: now })

  return new Promise((resolve) => {
    storage.set({ [HISTORY_KEY]: pruned }, resolve)
  })
}

export async function getWeekStats(): Promise<WeekStats> {
  const entries = await loadScoreHistory()
  const now = Date.now()
  const weekMs = 7 * 24 * 60 * 60 * 1000

  const thisWeek = entries.filter((e) => now - e.timestamp < weekMs)
  const lastWeek = entries.filter(
    (e) => now - e.timestamp >= weekMs && now - e.timestamp < 2 * weekMs
  )

  const avg = (arr: ScoreEntry[]) =>
    arr.length > 0
      ? Math.round(arr.reduce((sum, e) => sum + e.score, 0) / arr.length)
      : null

  return {
    thisWeekAvg: avg(thisWeek),
    lastWeekAvg: avg(lastWeek),
    thisWeekCount: thisWeek.length,
    totalCount: entries.length,
  }
}
