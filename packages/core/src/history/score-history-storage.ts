import { getStore } from "../storage/adapter"

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

export async function loadScoreHistory(): Promise<ScoreEntry[]> {
  const storage = getStore()
  if (!storage) return []
  const result = await storage.get(HISTORY_KEY)
  return (result[HISTORY_KEY] as ScoreEntry[]) ?? []
}

export async function saveScoreEntry(score: number): Promise<void> {
  const storage = getStore()
  if (!storage) return

  const now = Date.now()
  const existing = await loadScoreHistory()

  // Prune entries older than 90 days and append new entry
  const pruned = existing.filter((e) => now - e.timestamp < MAX_AGE_MS)
  pruned.push({ score, timestamp: now })

  await storage.set({ [HISTORY_KEY]: pruned })
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
