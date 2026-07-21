import { describe, expect, it } from "vitest"
import { analyzeTopicPerformance } from "~learning/algorithms/topic-learner"
import type { CollectedPost } from "~learning/types"

function makePost(topics: string[], er: number): CollectedPost {
  return {
    tweetId: Math.random().toString(36),
    text: "Test post about " + topics.join(" "),
    impressions: 1000,
    likes: 10,
    retweets: 5,
    replies: 2,
    quotes: 0,
    engagementRate: er,
    postedAt: Date.now() - 86400000,
    collectedAt: Date.now(),
    charCount: 100,
    hasImage: false,
    hasVideo: false,
    hasLink: false,
    isReply: false,
    hookType: "data_reveal",
    hookScore: 70,
    topics
  }
}

describe("analyzeTopicPerformance", () => {
  it("returns empty for zero baseline", () => {
    expect(analyzeTopicPerformance([], 0)).toEqual([])
  })

  it("requires 3+ posts per keyword", () => {
    const posts = [
      makePost(["ai"], 0.02),
      makePost(["ai"], 0.03)
    ]
    expect(analyzeTopicPerformance(posts, 0.01)).toEqual([])
  })

  it("calculates per-keyword performance", () => {
    const posts = [
      makePost(["ai", "agents"], 0.02),
      makePost(["ai", "agents"], 0.03),
      makePost(["ai", "longevity"], 0.04),
      makePost(["longevity"], 0.01),
      makePost(["longevity"], 0.01),
      makePost(["longevity"], 0.01)
    ]
    const result = analyzeTopicPerformance(posts, 0.02)
    const aiPerf = result.find((r) => r.keyword === "ai")
    expect(aiPerf).toBeDefined()
    expect(aiPerf!.postCount).toBe(3)
    // AI avgER: (0.02+0.03+0.04)/3 = 0.03, boost = 1.5
    expect(aiPerf!.boostMultiplier).toBeCloseTo(1.5, 1)
  })

  it("sorts by boost descending", () => {
    const posts = [
      makePost(["ai"], 0.04),
      makePost(["ai"], 0.04),
      makePost(["ai"], 0.04),
      makePost(["health"], 0.01),
      makePost(["health"], 0.01),
      makePost(["health"], 0.01)
    ]
    const result = analyzeTopicPerformance(posts, 0.02)
    expect(result[0].keyword).toBe("ai")
  })

  it("caps at 30 topics", () => {
    const topics = Array.from({ length: 35 }, (_, i) => `topic${i}`)
    const posts = topics.flatMap((t) => [
      makePost([t], 0.02),
      makePost([t], 0.02),
      makePost([t], 0.02)
    ])
    const result = analyzeTopicPerformance(posts, 0.01)
    expect(result.length).toBeLessThanOrEqual(30)
  })
})
