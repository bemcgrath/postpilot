import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { installPlatform, resetPlatform } from "@postpilot/core/storage/adapter"
import { createMemoryPlatform } from "@postpilot/core/storage/memory-store"
import { getWeekStats, loadScoreHistory, saveScoreEntry } from "../src/history/score-history-storage"

// First real coverage for this module -- see draft-storage.test.ts for why.

beforeEach(() => {
  installPlatform(createMemoryPlatform())
})

afterEach(() => {
  resetPlatform()
  vi.useRealTimers()
})

describe("score-history-storage", () => {
  it("starts empty", async () => {
    expect(await loadScoreHistory()).toEqual([])
  })

  it("appends entries in order", async () => {
    await saveScoreEntry(60)
    await saveScoreEntry(75)
    const entries = await loadScoreHistory()
    expect(entries.map((e) => e.score)).toEqual([60, 75])
  })

  it("prunes entries older than 90 days", async () => {
    const now = Date.parse("2026-06-01T00:00:00Z")
    vi.useFakeTimers()
    vi.setSystemTime(now - 100 * 24 * 60 * 60 * 1000) // 100 days before "now"
    await saveScoreEntry(40) // this one should get pruned
    vi.setSystemTime(now)
    await saveScoreEntry(80) // this one should survive

    const entries = await loadScoreHistory()
    expect(entries.map((e) => e.score)).toEqual([80])
  })

  it("getWeekStats splits this-week vs last-week and rounds averages", async () => {
    const now = Date.parse("2026-06-08T12:00:00Z")
    const day = 24 * 60 * 60 * 1000
    vi.useFakeTimers()

    vi.setSystemTime(now - 10 * day) // last week
    await saveScoreEntry(50)
    await saveScoreEntry(60)

    vi.setSystemTime(now - 2 * day) // this week
    await saveScoreEntry(70)
    await saveScoreEntry(85)

    vi.setSystemTime(now)
    const stats = await getWeekStats()

    expect(stats.thisWeekAvg).toBe(78) // round((70+85)/2)
    expect(stats.lastWeekAvg).toBe(55) // round((50+60)/2)
    expect(stats.thisWeekCount).toBe(2)
    expect(stats.totalCount).toBe(4)
  })

  it("getWeekStats returns nulls when there's no history", async () => {
    const stats = await getWeekStats()
    expect(stats).toEqual({
      thisWeekAvg: null,
      lastWeekAvg: null,
      thisWeekCount: 0,
      totalCount: 0
    })
  })
})
