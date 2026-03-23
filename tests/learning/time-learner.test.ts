import { describe, expect, it } from "vitest"
import { analyzeTimePerformance } from "~learning/algorithms/time-learner"
import type { CollectedPost } from "~learning/types"

function makePost(hour: number, er: number): CollectedPost {
  const date = new Date()
  date.setHours(hour, 0, 0, 0)
  return {
    tweetId: Math.random().toString(36),
    text: "Test post",
    impressions: 1000,
    likes: 10,
    retweets: 5,
    replies: 2,
    quotes: 0,
    engagementRate: er,
    postedAt: date.getTime(),
    collectedAt: Date.now(),
    charCount: 100,
    hasImage: false,
    hasVideo: false,
    hasLink: false,
    hookType: "data_reveal",
    hookScore: 70,
    topics: []
  }
}

describe("analyzeTimePerformance", () => {
  it("returns empty for zero baseline", () => {
    expect(analyzeTimePerformance([], 0)).toEqual([])
  })

  it("requires 2+ posts per hour", () => {
    const posts = [makePost(14, 0.03)]
    expect(analyzeTimePerformance(posts, 0.01)).toEqual([])
  })

  it("groups by hour and calculates performance", () => {
    const posts = [
      makePost(14, 0.04),
      makePost(14, 0.06),
      makePost(9, 0.01),
      makePost(9, 0.01)
    ]
    const result = analyzeTimePerformance(posts, 0.02)
    expect(result.length).toBe(2)
    // Best hour first (14 = 2 PM with 2.5x boost clamped to 2.0)
    expect(result[0].hour).toBe(14)
    expect(result[0].boostMultiplier).toBe(2.0)
  })

  it("sorts by boost descending", () => {
    const posts = [
      makePost(8, 0.01),
      makePost(8, 0.01),
      makePost(14, 0.04),
      makePost(14, 0.04),
      makePost(20, 0.02),
      makePost(20, 0.02)
    ]
    const result = analyzeTimePerformance(posts, 0.02)
    expect(result[0].hour).toBe(14)
  })
})
