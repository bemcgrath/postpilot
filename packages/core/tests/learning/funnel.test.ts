import { describe, expect, it } from "vitest"
import { mergeSkipIds, summarizeFunnel, EMPTY_FUNNEL } from "~learning/funnel"
import type { CollectedPost } from "~learning/types"
import { MIN_POSTS_FOR_LEARNING } from "~learning/types"

function post(id: string): CollectedPost {
  return {
    tweetId: id,
    text: "hello",
    impressions: 10,
    likes: 1,
    retweets: 0,
    replies: 0,
    quotes: 0,
    engagementRate: 0.1,
    postedAt: 1,
    collectedAt: 2,
    charCount: 5,
    hasImage: false,
    hasVideo: false,
    hasLink: false,
    isReply: false,
    hookType: null,
    hookScore: 0,
    topics: []
  }
}

describe("mergeSkipIds", () => {
  it("appends unique skip ids", () => {
    const merged = mergeSkipIds(EMPTY_FUNNEL, [
      { tweetId: "1", reason: "too_new" },
      { tweetId: "1", reason: "too_new" },
      { tweetId: "2", reason: "no_impressions" }
    ])
    expect(merged.waitingOnAgeIds).toEqual(["1"])
    expect(merged.missingImpressionIds).toEqual(["2"])
  })

  it("moves a tweet from waiting-on-age to missing impressions", () => {
    const stored = mergeSkipIds(EMPTY_FUNNEL, [{ tweetId: "1", reason: "too_new" }])
    const next = mergeSkipIds(stored, [{ tweetId: "1", reason: "no_impressions" }])
    expect(next.waitingOnAgeIds).toEqual([])
    expect(next.missingImpressionIds).toEqual(["1"])
  })
})

describe("summarizeFunnel", () => {
  it("ignores skip ids that were later collected", () => {
    const snap = summarizeFunnel({
      handle: "alice",
      posts: [post("1")],
      waitingOnAgeIds: ["1", "2"],
      missingImpressionIds: ["1", "3"]
    })
    expect(snap.collected).toBe(1)
    expect(snap.waitingOnAge).toBe(1)
    expect(snap.missingImpressions).toBe(1)
    expect(snap.isReady).toBe(false)
    expect(snap.needed).toBe(MIN_POSTS_FOR_LEARNING)
  })

  it("is ready at the learning threshold", () => {
    const posts = Array.from({ length: MIN_POSTS_FOR_LEARNING }, (_, i) =>
      post(String(i))
    )
    const snap = summarizeFunnel({
      handle: "alice",
      posts,
      waitingOnAgeIds: [],
      missingImpressionIds: []
    })
    expect(snap.isReady).toBe(true)
  })
})
