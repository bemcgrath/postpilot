import { describe, expect, it } from "vitest"
import {
  analyzeHookTypePerformance,
  smoothHookTypeBoosts
} from "~learning/algorithms/hook-type-learner"
import type { CollectedPost } from "~learning/types"

function makePost(
  overrides: Partial<CollectedPost> = {}
): CollectedPost {
  return {
    tweetId: Math.random().toString(36),
    text: "Test post",
    impressions: 1000,
    likes: 10,
    retweets: 5,
    replies: 2,
    quotes: 0,
    engagementRate: 0.017,
    postedAt: Date.now() - 86400000,
    collectedAt: Date.now(),
    charCount: 100,
    hasImage: false,
    hasVideo: false,
    hasLink: false,
    hookType: "data_reveal",
    hookScore: 70,
    topics: ["ai"],
    ...overrides
  }
}

describe("analyzeHookTypePerformance", () => {
  it("returns empty for zero baseline", () => {
    const posts = [makePost(), makePost(), makePost()]
    expect(analyzeHookTypePerformance(posts, 0)).toEqual([])
  })

  it("requires minimum 3 posts per type", () => {
    const posts = [
      makePost({ hookType: "data_reveal" }),
      makePost({ hookType: "data_reveal" })
    ]
    expect(analyzeHookTypePerformance(posts, 0.01)).toEqual([])
  })

  it("calculates boost multiplier correctly", () => {
    const posts = [
      makePost({ hookType: "data_reveal", engagementRate: 0.02 }),
      makePost({ hookType: "data_reveal", engagementRate: 0.03 }),
      makePost({ hookType: "data_reveal", engagementRate: 0.04 })
    ]
    const result = analyzeHookTypePerformance(posts, 0.01)
    expect(result).toHaveLength(1)
    expect(result[0].hookType).toBe("data_reveal")
    expect(result[0].postCount).toBe(3)
    // avgER = 0.03, baseline = 0.01, boost = 3.0 clamped to 2.0
    expect(result[0].boostMultiplier).toBe(2.0)
  })

  it("clamps boost to 0.5-2.0 range", () => {
    const lowPosts = [
      makePost({ hookType: "question", engagementRate: 0.001 }),
      makePost({ hookType: "question", engagementRate: 0.001 }),
      makePost({ hookType: "question", engagementRate: 0.001 })
    ]
    const result = analyzeHookTypePerformance(lowPosts, 0.01)
    expect(result[0].boostMultiplier).toBe(0.5)
  })

  it("sorts by boost multiplier descending", () => {
    const posts = [
      makePost({ hookType: "data_reveal", engagementRate: 0.03 }),
      makePost({ hookType: "data_reveal", engagementRate: 0.03 }),
      makePost({ hookType: "data_reveal", engagementRate: 0.03 }),
      makePost({ hookType: "contrarian", engagementRate: 0.01 }),
      makePost({ hookType: "contrarian", engagementRate: 0.01 }),
      makePost({ hookType: "contrarian", engagementRate: 0.01 })
    ]
    const result = analyzeHookTypePerformance(posts, 0.02)
    expect(result[0].hookType).toBe("data_reveal")
    expect(result[1].hookType).toBe("contrarian")
  })

  it("skips posts with null hookType", () => {
    const posts = [
      makePost({ hookType: null }),
      makePost({ hookType: null }),
      makePost({ hookType: null })
    ]
    expect(analyzeHookTypePerformance(posts, 0.01)).toEqual([])
  })

  it("keeps max 3 top examples", () => {
    const posts = Array.from({ length: 5 }, (_, i) =>
      makePost({
        hookType: "data_reveal",
        engagementRate: 0.01 * (i + 1)
      })
    )
    const result = analyzeHookTypePerformance(posts, 0.01)
    expect(result[0].topExamples).toHaveLength(3)
  })
})

describe("smoothHookTypeBoosts", () => {
  it("returns current when no previous", () => {
    const current = { data_reveal: 1.5, contrarian: 0.8 }
    expect(smoothHookTypeBoosts(current, undefined)).toEqual(current)
  })

  it("applies EMA smoothing (0.3 new + 0.7 old)", () => {
    const current = { data_reveal: 2.0 }
    const previous = { data_reveal: 1.0 }
    const smoothed = smoothHookTypeBoosts(current, previous)
    // 0.3 * 2.0 + 0.7 * 1.0 = 1.3
    expect(smoothed.data_reveal).toBeCloseTo(1.3, 5)
  })

  it("drops types only in previous", () => {
    const current = { data_reveal: 1.5 }
    const previous = { data_reveal: 1.2, contrarian: 1.8 }
    const smoothed = smoothHookTypeBoosts(current, previous)
    expect(smoothed.data_reveal).toBeDefined()
    expect(smoothed.contrarian).toBeUndefined()
  })

  it("keeps types only in current", () => {
    const current = { contrarian: 1.6 }
    const previous = { data_reveal: 1.2 }
    const smoothed = smoothHookTypeBoosts(current, previous)
    expect(smoothed.contrarian).toBe(1.6)
    expect(smoothed.data_reveal).toBeUndefined()
  })
})
