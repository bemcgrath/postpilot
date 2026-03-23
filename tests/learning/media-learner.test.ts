import { describe, expect, it } from "vitest"
import { analyzeMediaPerformance } from "~learning/algorithms/media-learner"
import type { CollectedPost } from "~learning/types"

function makePost(
  hasImage: boolean,
  hasLink: boolean,
  er: number
): CollectedPost {
  return {
    tweetId: Math.random().toString(36),
    text: "Test post",
    impressions: 1000,
    likes: 10,
    retweets: 5,
    replies: 2,
    quotes: 0,
    engagementRate: er,
    postedAt: Date.now() - 86400000,
    collectedAt: Date.now(),
    charCount: 100,
    hasImage,
    hasVideo: false,
    hasLink,
    hookType: "data_reveal",
    hookScore: 70,
    topics: []
  }
}

describe("analyzeMediaPerformance", () => {
  it("returns null for fewer than 5 posts", () => {
    const posts = [
      makePost(true, false, 0.03),
      makePost(false, false, 0.01)
    ]
    expect(analyzeMediaPerformance(posts)).toBeNull()
  })

  it("calculates image boost correctly", () => {
    const posts = [
      makePost(true, false, 0.04),
      makePost(true, false, 0.06),
      makePost(false, false, 0.02),
      makePost(false, false, 0.02),
      makePost(false, false, 0.02)
    ]
    const result = analyzeMediaPerformance(posts)!
    expect(result.withImage.postCount).toBe(2)
    expect(result.withImage.avgER).toBeCloseTo(0.05, 5)
    expect(result.withoutImage.postCount).toBe(3)
    expect(result.withoutImage.avgER).toBeCloseTo(0.02, 5)
    expect(result.imageBoost).toBeCloseTo(2.5, 1)
  })

  it("calculates link boost correctly", () => {
    const posts = [
      makePost(false, true, 0.01),
      makePost(false, true, 0.01),
      makePost(false, false, 0.02),
      makePost(false, false, 0.02),
      makePost(false, false, 0.02)
    ]
    const result = analyzeMediaPerformance(posts)!
    expect(result.linkBoost).toBeCloseTo(0.5, 1)
  })

  it("handles no images gracefully", () => {
    const posts = [
      makePost(false, false, 0.02),
      makePost(false, false, 0.02),
      makePost(false, false, 0.02),
      makePost(false, false, 0.02),
      makePost(false, false, 0.02)
    ]
    const result = analyzeMediaPerformance(posts)!
    expect(result.withImage.postCount).toBe(0)
    expect(result.imageBoost).toBe(1.0) // no images → default 1.0
  })
})
