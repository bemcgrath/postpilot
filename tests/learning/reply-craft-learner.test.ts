import { describe, expect, it } from "vitest"
import { analyzeReplyCraft } from "~learning/algorithms/reply-craft-learner"
import type { CollectedPost } from "~learning/types"

function makePost(overrides: Partial<CollectedPost> = {}): CollectedPost {
  return {
    tweetId: Math.random().toString(36),
    text: "Test post about building AI agents",
    impressions: 1000,
    likes: 10,
    retweets: 5,
    replies: 2,
    quotes: 0,
    engagementRate: 0.017,
    postedAt: Date.now() - 86400000,
    collectedAt: Date.now(),
    charCount: 200,
    hasImage: false,
    hasVideo: false,
    hasLink: false,
    isReply: true,
    hookType: null,
    hookScore: 50,
    topics: [],
    ...overrides
  }
}

describe("analyzeReplyCraft", () => {
  it("returns null below MIN_REPLIES_FOR_LEARNING", () => {
    const replies = Array.from({ length: 7 }, () => makePost())
    expect(analyzeReplyCraft(replies)).toBeNull()
  })

  it("separates mechanism-heavy winners from praise-only losers", () => {
    const mechanismReplies = Array.from({ length: 5 }, () =>
      makePost({
        text: "Good point. The actual bottleneck here is review-queue ownership drift.",
        engagementRate: 0.2,
        charCount: 74
      })
    )
    const praiseReplies = Array.from({ length: 5 }, () =>
      makePost({ text: "Love this", engagementRate: 0, charCount: 9 })
    )

    const result = analyzeReplyCraft([...mechanismReplies, ...praiseReplies])

    expect(result).not.toBeNull()
    expect(result!.craftSignals.mechanismShare).toBeGreaterThan(0)
    expect(result!.craftSignals.praiseOnlyShareLow).toBeGreaterThan(0)
    expect(
      result!.topExamples.every((e) => e.text.includes("bottleneck"))
    ).toBe(true)
    expect(result!.lowExamples.every((e) => e.text === "Love this")).toBe(
      true
    )
  })

  it("strips leading handles from top/low example text", () => {
    const mechanismReplies = Array.from({ length: 5 }, () =>
      makePost({
        text: "@alice Good point. The actual bottleneck here is review-queue drift.",
        engagementRate: 0.2
      })
    )
    const filler = Array.from({ length: 3 }, () =>
      makePost({ text: "@bob so true", engagementRate: 0 })
    )

    const result = analyzeReplyCraft([...mechanismReplies, ...filler])

    expect(result).not.toBeNull()
    expect(result!.topExamples.every((e) => !e.text.startsWith("@"))).toBe(
      true
    )
    expect(result!.lowExamples.every((e) => !e.text.startsWith("@"))).toBe(
      true
    )
  })

  it("brackets optimalLengthRange around the top examples' stripped mean, clamped 40-260", () => {
    const text = "Good point. The actual bottleneck is review-queue ownership drift here."
    const strippedLen = text.length // no leading handle to strip in this case

    const top5 = Array.from({ length: 5 }, () =>
      makePost({ text, engagementRate: 0.2 })
    )
    const low3 = Array.from({ length: 3 }, () =>
      makePost({ text: "so true", engagementRate: 0 })
    )

    const result = analyzeReplyCraft([...top5, ...low3])

    expect(result).not.toBeNull()
    expect(result!.optimalLengthRange.min).toBe(
      Math.max(40, Math.round(strippedLen * 0.7))
    )
    expect(result!.optimalLengthRange.max).toBe(
      Math.min(260, Math.round(strippedLen * 1.3))
    )
  })

  it("uses reply-specific length buckets, not the originals' 0-100 first bucket", () => {
    const replies = [
      ...Array.from({ length: 4 }, () =>
        makePost({ charCount: 90, engagementRate: 0.05 })
      ),
      ...Array.from({ length: 4 }, () =>
        makePost({ charCount: 120, engagementRate: 0.05 })
      ),
      makePost({ charCount: 30, engagementRate: 0.05 })
    ]

    const result = analyzeReplyCraft(replies)

    expect(result).not.toBeNull()
    const bucket80to130 = result!.lengthPerformance.find(
      (b) => b.bucket === "80-130"
    )
    expect(bucket80to130).toBeDefined()
    expect(bucket80to130!.postCount).toBe(8)

    const bucket0to40 = result!.lengthPerformance.find(
      (b) => b.bucket === "0-40"
    )
    expect(bucket0to40).toBeDefined()
    expect(bucket0to40!.postCount).toBe(1)
  })
})
