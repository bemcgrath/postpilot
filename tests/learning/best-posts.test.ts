import { describe, expect, it } from "vitest"
import { selectBestPostsForImport, MAX_IMPORT_SUGGESTIONS } from "~learning/best-posts"
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
    hookType: "data_reveal",
    hookScore: 70,
    topics: ["building", "agents"],
    ...overrides
  }
}

describe("selectBestPostsForImport", () => {
  it("returns nothing below the learning engine's minimum data bar", () => {
    const posts = Array.from({ length: 10 }, () => makePost({ engagementRate: 0.05 }))
    expect(selectBestPostsForImport(posts, new Set())).toEqual([])
  })

  it("returns nothing when baseline engagement is 0", () => {
    const posts = Array.from({ length: 20 }, () => makePost({ engagementRate: 0 }))
    expect(selectBestPostsForImport(posts, new Set())).toEqual([])
  })

  it("only suggests posts above baseline, ranked descending", () => {
    const posts = [
      ...Array.from({ length: 18 }, () => makePost({ engagementRate: 0.01 })),
      makePost({ tweetId: "best", engagementRate: 0.09 }),
      makePost({ tweetId: "second", engagementRate: 0.05 })
    ]
    const result = selectBestPostsForImport(posts, new Set())
    expect(result.map((c) => c.tweetId)).toEqual(["best", "second"])
    expect(result[0].boostMultiplier).toBeGreaterThan(result[1].boostMultiplier)
  })

  it("excludes already-imported tweet ids", () => {
    const posts = [
      ...Array.from({ length: 18 }, () => makePost({ engagementRate: 0.01 })),
      makePost({ tweetId: "already-in", engagementRate: 0.09 }),
      makePost({ tweetId: "new", engagementRate: 0.05 })
    ]
    const result = selectBestPostsForImport(posts, new Set(["already-in"]))
    expect(result.map((c) => c.tweetId)).toEqual(["new"])
  })

  it("caps suggestions at MAX_IMPORT_SUGGESTIONS", () => {
    const posts = [
      ...Array.from({ length: 5 }, () => makePost({ engagementRate: 0.01 })),
      ...Array.from({ length: 15 }, (_, i) =>
        makePost({ tweetId: `top-${i}`, engagementRate: 0.05 + i * 0.001 })
      )
    ]
    const result = selectBestPostsForImport(posts, new Set())
    expect(result).toHaveLength(MAX_IMPORT_SUGGESTIONS)
  })

  it("computes boostMultiplier as engagementRate divided by baseline", () => {
    const posts = [
      ...Array.from({ length: 19 }, () => makePost({ engagementRate: 0.02 })),
      makePost({ tweetId: "star", engagementRate: 0.06 })
    ]
    const result = selectBestPostsForImport(posts, new Set())
    expect(result).toHaveLength(1)
    expect(result[0].boostMultiplier).toBeCloseTo(3, 5) // 0.06 / 0.02
  })

  it("carries the impressions count through for display", () => {
    const posts = [
      ...Array.from({ length: 19 }, () => makePost({ engagementRate: 0.02 })),
      makePost({ tweetId: "star", engagementRate: 0.06, impressions: 45210 })
    ]
    const result = selectBestPostsForImport(posts, new Set())
    expect(result[0].impressions).toBe(45210)
  })
})
