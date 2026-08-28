import { describe, expect, it } from "vitest"
import { estimateReachRange, formatReach, MIN_POSTS_FOR_REACH } from "~learning/reach"
import type { CollectedPost } from "~learning/types"

function post(overrides: Partial<CollectedPost> = {}): CollectedPost {
  return {
    tweetId: Math.random().toString(36),
    text: "hello",
    impressions: 1000,
    likes: 10,
    retweets: 1,
    replies: 1,
    quotes: 0,
    engagementRate: 0.01,
    postedAt: 1,
    collectedAt: 2,
    charCount: 200,
    hasImage: false,
    hasVideo: false,
    hasLink: false,
    isReply: false,
    hookType: "declarative_claim",
    hookScore: 70,
    topics: [],
    ...overrides
  }
}

describe("estimateReachRange", () => {
  it("hides until n is honest", () => {
    const posts = Array.from({ length: MIN_POSTS_FOR_REACH - 1 }, (_, i) =>
      post({ tweetId: String(i), impressions: 1000 + i * 100 })
    )
    expect(
      estimateReachRange(posts, {
        hookType: "declarative_claim",
        charCount: 200,
        isReply: false
      })
    ).toBeNull()
  })

  it("returns a p25–p75 range, never a single invented count", () => {
    const posts = Array.from({ length: 12 }, (_, i) =>
      post({
        tweetId: String(i),
        impressions: 400 + i * 200,
        hookType: "declarative_claim"
      })
    )
    const range = estimateReachRange(posts, {
      hookType: "declarative_claim",
      charCount: 200,
      isReply: false
    })
    expect(range).not.toBeNull()
    expect(range!.n).toBe(12)
    expect(range!.low).toBeLessThan(range!.high)
  })

  it("does not mix replies into originals", () => {
    const originals = Array.from({ length: 10 }, (_, i) =>
      post({ tweetId: `o${i}`, impressions: 2000 + i * 50, isReply: false })
    )
    const replies = Array.from({ length: 10 }, (_, i) =>
      post({ tweetId: `r${i}`, impressions: 50, isReply: true, hookType: "question" })
    )
    const range = estimateReachRange([...originals, ...replies], {
      hookType: "declarative_claim",
      charCount: 200,
      isReply: false
    })
    expect(range!.low).toBeGreaterThan(1000)
  })
})

describe("formatReach", () => {
  it("compacts thousands and millions", () => {
    expect(formatReach(800)).toBe("800")
    expect(formatReach(1200)).toBe("1.2K")
    expect(formatReach(48000)).toBe("48K")
    expect(formatReach(1_500_000)).toBe("1.5M")
  })
})
