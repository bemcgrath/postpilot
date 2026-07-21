import { describe, expect, it } from "vitest"
import { analyzeLengthPerformance } from "~learning/algorithms/length-learner"
import type { CollectedPost } from "~learning/types"

function makePost(charCount: number, er: number): CollectedPost {
  return {
    tweetId: Math.random().toString(36),
    text: "x".repeat(charCount),
    impressions: 1000,
    likes: 10,
    retweets: 5,
    replies: 2,
    quotes: 0,
    engagementRate: er,
    postedAt: Date.now() - 86400000,
    collectedAt: Date.now(),
    charCount,
    hasImage: false,
    hasVideo: false,
    hasLink: false,
    isReply: false,
    hookType: "data_reveal",
    hookScore: 70,
    topics: []
  }
}

describe("analyzeLengthPerformance", () => {
  it("returns empty for zero baseline", () => {
    const { buckets } = analyzeLengthPerformance([makePost(100, 0.01)], 0)
    expect(buckets).toEqual([])
  })

  it("assigns posts to correct buckets", () => {
    const posts = [
      makePost(50, 0.01),
      makePost(150, 0.02),
      makePost(250, 0.03),
      makePost(300, 0.04),
      makePost(350, 0.02),
      makePost(450, 0.01)
    ]
    const { buckets } = analyzeLengthPerformance(posts, 0.02)

    expect(buckets.find((b) => b.bucket === "0-100")?.postCount).toBe(1)
    expect(buckets.find((b) => b.bucket === "100-200")?.postCount).toBe(1)
    expect(buckets.find((b) => b.bucket === "200-280")?.postCount).toBe(1)
    expect(buckets.find((b) => b.bucket === "280-320")?.postCount).toBe(1)
    expect(buckets.find((b) => b.bucket === "320-400")?.postCount).toBe(1)
    expect(buckets.find((b) => b.bucket === "400+")?.postCount).toBe(1)
  })

  it("identifies optimal range from highest ER bucket", () => {
    const posts = [
      makePost(290, 0.05),
      makePost(300, 0.06),
      makePost(310, 0.04),
      makePost(150, 0.01),
      makePost(160, 0.01)
    ]
    const { optimalRange } = analyzeLengthPerformance(posts, 0.02)
    expect(optimalRange).toEqual({ min: 280, max: 320 })
  })

  it("requires 2+ posts for optimal range", () => {
    const posts = [makePost(300, 0.05)]
    const { optimalRange } = analyzeLengthPerformance(posts, 0.02)
    expect(optimalRange).toBeNull()
  })

  it("calculates boost multiplier correctly", () => {
    const posts = [
      makePost(300, 0.04),
      makePost(310, 0.06)
    ]
    const { buckets } = analyzeLengthPerformance(posts, 0.02)
    const bucket280 = buckets.find((b) => b.bucket === "280-320")
    // avgER = 0.05, baseline = 0.02, boost = 2.5 clamped to 2.0
    expect(bucket280?.boostMultiplier).toBe(2.0)
  })
})
