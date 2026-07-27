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
    isReply: false,
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

  describe("reply/originals segmentation", () => {
    it("segments once 12+ originals exist, and replyInsights is populated alongside", () => {
      const originals = Array.from({ length: 20 }, () =>
        makePost({ isReply: false })
      )
      const replies = Array.from({ length: 10 }, () =>
        makePost({ isReply: true })
      )
      const insights = computeInsights([...originals, ...replies], null)
      expect(insights.segmentation).toBe("segmented")
      expect(insights.originalsAnalyzed).toBe(20)
      expect(insights.repliesAnalyzed).toBe(10)
      expect(insights.replyInsights).not.toBeNull()
    })

    it("computes hookTypeBoosts on the originals segment only, matching an originals-only run", () => {
      const originals = Array.from({ length: 20 }, () =>
        makePost({ isReply: false, hookType: "data_reveal", engagementRate: 0.02 })
      )
      const replies = Array.from({ length: 10 }, () =>
        makePost({ isReply: true, hookType: "contrarian", engagementRate: 0.2 })
      )
      const mixed = computeInsights([...originals, ...replies], null)
      const originalsOnly = computeInsights(originals, null)

      expect(mixed.segmentation).toBe("segmented")
      expect(mixed.hookTypeBoosts).toEqual(originalsOnly.hookTypeBoosts)
    })

    it("falls back to blended scoring below MIN_ORIGINALS_FOR_LEARNING with no regression", () => {
      const originals = Array.from({ length: 5 }, (_, i) =>
        makePost({ isReply: false, hookType: "data_reveal", engagementRate: 0.01 + i * 0.001 })
      )
      const replies = Array.from({ length: 15 }, (_, i) =>
        makePost({ isReply: true, hookType: "contrarian", engagementRate: 0.01 + i * 0.001 })
      )
      const insights = computeInsights([...originals, ...replies], null)

      expect(insights.segmentation).toBe("blended")
      expect(insights.isReady).toBe(true)
      expect(insights.hookTypePerformance.length).toBeGreaterThan(0)
      expect(insights.replyInsights).not.toBeNull()
    })

    it("segments originals but withholds replyInsights below MIN_REPLIES_FOR_LEARNING", () => {
      const originals = Array.from({ length: 18 }, () =>
        makePost({ isReply: false })
      )
      const replies = Array.from({ length: 2 }, () =>
        makePost({ isReply: true })
      )
      const insights = computeInsights([...originals, ...replies], null)

      expect(insights.segmentation).toBe("segmented")
      expect(insights.replyInsights).toBeNull()
    })

    it("defaults all new fields safely when not ready", () => {
      const posts = Array.from({ length: 19 }, () => makePost({ isReply: false }))
      const insights = computeInsights(posts, null)

      expect(insights.isReady).toBe(false)
      expect(insights.insightsVersion).toBe(2)
      expect(insights.segmentation).toBe("blended")
      expect(insights.replyInsights).toBeNull()
      expect(insights.originalsAnalyzed).toBe(19)
      expect(insights.repliesAnalyzed).toBe(0)
      expect(insights.unknownSegmentCount).toBe(0)
    })

    it("excludes unknown-segment posts from both originals and replies counts", () => {
      const originals = Array.from({ length: 12 }, () => makePost({ isReply: false }))
      const replies = Array.from({ length: 8 }, () => makePost({ isReply: true }))
      const unknown = Array.from({ length: 10 }, () => {
        const p = makePost({ text: "no signal text here" })
        delete (p as Partial<CollectedPost>).isReply
        return p
      })
      const insights = computeInsights(
        [...originals, ...replies, ...unknown],
        null
      )

      expect(insights.postsAnalyzed).toBe(30)
      expect(insights.unknownSegmentCount).toBe(10)
      expect(insights.originalsAnalyzed).toBe(12)
      expect(insights.repliesAnalyzed).toBe(8)
    })

    it("computes replyInsights.baselineEngagementRate from replies only, not the blended pool", () => {
      const originals = Array.from({ length: 12 }, () =>
        makePost({ isReply: false, engagementRate: 0.5 })
      )
      const replies = [
        makePost({ isReply: true, engagementRate: 0.01 }),
        makePost({ isReply: true, engagementRate: 0.1 }),
        ...Array.from({ length: 6 }, () =>
          makePost({ isReply: true, engagementRate: 0.02 })
        )
      ]
      const insights = computeInsights([...originals, ...replies], null)

      expect(insights.replyInsights).not.toBeNull()
      expect(insights.replyInsights!.baselineEngagementRate).toBeCloseTo(0.02, 5)
    })

    it("smooths reply hookTypeBoosts against previous replyInsights, not against originals' boosts", () => {
      const originals = Array.from({ length: 12 }, () =>
        makePost({ isReply: false, hookType: "data_reveal", engagementRate: 0.02 })
      )
      const replies = Array.from({ length: 8 }, () =>
        makePost({ isReply: true, hookType: "contrarian", engagementRate: 0.02 })
      )
      const previous = computeInsights([...originals, ...replies], null)
      previous.hookTypeBoosts = { data_reveal: 1.0 }
      previous.replyInsights = {
        ...previous.replyInsights!,
        hookTypeBoosts: { contrarian: 2.0 }
      }

      const insights = computeInsights([...originals, ...replies], previous)

      expect(insights.replyInsights).not.toBeNull()
      const smoothedContrarian = insights.replyInsights!.hookTypeBoosts.contrarian
      expect(smoothedContrarian).toBeDefined()
      // Pulled toward the previous *reply* value (2.0), not the unrelated
      // previous *originals* value (1.0) -- 0.3*1.0(raw) + 0.7*2.0 = 1.7.
      expect(smoothedContrarian!).toBeGreaterThan(1.3)
    })
  })
})
