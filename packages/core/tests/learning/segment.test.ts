import { describe, expect, it } from "vitest"
import { partitionPosts, segmentOf } from "~learning/segment"
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

describe("segmentOf", () => {
  it("classifies isReply: true as reply", () => {
    expect(segmentOf(makePost({ isReply: true }))).toBe("reply")
  })

  it("classifies isReply: false as original", () => {
    expect(segmentOf(makePost({ isReply: false }))).toBe("original")
  })

  it("classifies missing isReply as unknown, not original", () => {
    const post = makePost({ text: "Some standalone-looking text" })
    delete (post as Partial<CollectedPost>).isReply
    expect(segmentOf(post)).toBe("unknown")
  })

  it("falls back to reply when isReply is missing but text starts with @handle", () => {
    const post = makePost({ text: "@someone great point about this" })
    delete (post as Partial<CollectedPost>).isReply
    expect(segmentOf(post)).toBe("reply")
  })
})

describe("partitionPosts", () => {
  it("counts sum to the input length across a mixed array", () => {
    const posts = [
      makePost({ isReply: false }),
      makePost({ isReply: true }),
      makePost({ isReply: true }),
      (() => {
        const p = makePost({ text: "no signal here at all" })
        delete (p as Partial<CollectedPost>).isReply
        return p
      })()
    ]
    const { originals, replies, unknown } = partitionPosts(posts)
    expect(originals).toHaveLength(1)
    expect(replies).toHaveLength(2)
    expect(unknown).toHaveLength(1)
    expect(originals.length + replies.length + unknown.length).toBe(
      posts.length
    )
  })
})
