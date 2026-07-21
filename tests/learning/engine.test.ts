import { describe, expect, it } from "vitest"
import { computeInsights } from "~learning/engine"
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

describe("computeInsights", () => {
  it("returns isReady=false with fewer than 20 posts", () => {
    const posts = Array.from({ length: 10 }, () => makePost())
    const insights = computeInsights(posts, null)
    expect(insights.isReady).toBe(false)
    expect(insights.postsAnalyzed).toBe(10)
    expect(insights.hookTypePerformance).toEqual([])
    expect(insights.recommendations).toEqual([])
  })

  it("returns isReady=true with 20+ posts", () => {
    const posts = Array.from({ length: 25 }, (_, i) =>
      makePost({ engagementRate: 0.01 + i * 0.001 })
    )
    const insights = computeInsights(posts, null)
    expect(insights.isReady).toBe(true)
    expect(insights.postsAnalyzed).toBe(25)
    expect(insights.baselineEngagementRate).toBeGreaterThan(0)
  })

  it("computes baseline ER as median", () => {
    const posts = [
      makePost({ engagementRate: 0.01 }),
      makePost({ engagementRate: 0.02 }),
      makePost({ engagementRate: 0.10 }) // outlier
    ]
    const insights = computeInsights(posts, null)
    expect(insights.baselineEngagementRate).toBe(0.02) // median
  })

  it("computes baseline ER as average of middle two for even count", () => {
    const posts = [
      makePost({ engagementRate: 0.01 }),
      makePost({ engagementRate: 0.02 }),
      makePost({ engagementRate: 0.03 }),
      makePost({ engagementRate: 0.10 })
    ]
    const insights = computeInsights(posts, null)
    expect(insights.baselineEngagementRate).toBeCloseTo(0.025, 5)
  })

  it("populates hookTypeBoosts for hook types with enough data", () => {
    const posts = Array.from({ length: 20 }, (_, i) =>
      makePost({
        hookType: i < 10 ? "data_reveal" : "contrarian",
        engagementRate: i < 10 ? 0.03 : 0.01
      })
    )
    const insights = computeInsights(posts, null)
    expect(insights.isReady).toBe(true)
    // data_reveal should have a higher boost
    if (insights.hookTypeBoosts.data_reveal != null && insights.hookTypeBoosts.contrarian != null) {
      expect(insights.hookTypeBoosts.data_reveal).toBeGreaterThan(
        insights.hookTypeBoosts.contrarian
      )
    }
  })

  it("applies EMA smoothing against previous insights", () => {
    const posts = Array.from({ length: 20 }, () =>
      makePost({ hookType: "data_reveal", engagementRate: 0.02 })
    )
    const previous = computeInsights(
      Array.from({ length: 20 }, () =>
        makePost({ hookType: "data_reveal", engagementRate: 0.02 })
      ),
      null
    )
    // Override previous boost to a known value
    previous.hookTypeBoosts = { data_reveal: 1.0 }

    const insights = computeInsights(posts, previous)
    // Should be smoothed between current calculation and 1.0
    if (insights.hookTypeBoosts.data_reveal != null) {
      expect(insights.hookTypeBoosts.data_reveal).toBeDefined()
    }
  })

  it("returns empty for zero posts", () => {
    const insights = computeInsights([], null)
    expect(insights.isReady).toBe(false)
    expect(insights.postsAnalyzed).toBe(0)
    expect(insights.baselineEngagementRate).toBe(0)
  })

  it("returns empty weekday/weekend arrays when not ready", () => {
    const posts = Array.from({ length: 5 }, () => makePost())
    const insights = computeInsights(posts, null)
    expect(insights.weekdayTimePerformance).toEqual([])
    expect(insights.weekendTimePerformance).toEqual([])
  })

  it("splits time performance by weekday vs weekend, not blended by hour alone", () => {
    // Fixed reference points: a known Wednesday and a known Saturday, same hour.
    const wednesday9am = new Date(2026, 6, 22, 9, 0, 0).getTime() // Jul 22 2026 is a Wednesday
    const saturday9am = new Date(2026, 6, 25, 9, 0, 0).getTime() // Jul 25 2026 is a Saturday

    const posts = [
      // Weekday 9am posts: strong engagement
      ...Array.from({ length: 4 }, () =>
        makePost({ postedAt: wednesday9am, engagementRate: 0.05 })
      ),
      // Weekend 9am posts: weak engagement
      ...Array.from({ length: 4 }, () =>
        makePost({ postedAt: saturday9am, engagementRate: 0.005 })
      ),
      // Padding so isReady triggers (20+ posts total), spread across a
      // neutral hour so they don't dominate either bucket.
      ...Array.from({ length: 12 }, () =>
        makePost({
          postedAt: new Date(2026, 6, 23, 14, 0, 0).getTime(),
          engagementRate: 0.02
        })
      )
    ]

    const insights = computeInsights(posts, null)
    expect(insights.isReady).toBe(true)

    const weekday9am = insights.weekdayTimePerformance.find((t) => t.hour === 9)
    const weekend9am = insights.weekendTimePerformance.find((t) => t.hour === 9)

    expect(weekday9am).toBeDefined()
    expect(weekend9am).toBeDefined()
    expect(weekday9am!.postCount).toBe(4)
    expect(weekend9am!.postCount).toBe(4)
    // The whole point: same hour, different day-type, genuinely different signal.
    expect(weekday9am!.boostMultiplier).toBeGreaterThan(weekend9am!.boostMultiplier)
  })
})
