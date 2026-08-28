import { describe, expect, it } from "vitest"
import { analyzeMediaPerformance } from "~learning/algorithms/media-learner"
import type { CollectedPost } from "~learning/types"

function makePost(
  hasImage: boolean,
  hasLink: boolean,
  er: number,
  hasVideo: boolean = false
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
    hasVideo,
    hasLink,
    isReply: false,
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

  it("calculates video boost independently of image boost", () => {
    const posts = [
      makePost(false, false, 0.05, true),
      makePost(false, false, 0.07, true),
      makePost(false, false, 0.02, false),
      makePost(false, false, 0.02, false),
      makePost(false, false, 0.02, false)
    ]
    const result = analyzeMediaPerformance(posts)!
    expect(result.withVideo.postCount).toBe(2)
    expect(result.withVideo.avgER).toBeCloseTo(0.06, 5)
    expect(result.withoutVideo.postCount).toBe(3)
    expect(result.videoBoost).toBeCloseTo(3.0, 1)
    // A video-only post carries no image, so it must not also count toward
    // the image split -- image and video are independent partitions.
    expect(result.withImage.postCount).toBe(0)
    expect(result.imageBoost).toBe(1.0)
  })

  it("handles no videos gracefully", () => {
    const posts = [
      makePost(true, false, 0.02),
      makePost(true, false, 0.02),
      makePost(false, false, 0.02),
      makePost(false, false, 0.02),
      makePost(false, false, 0.02)
    ]
    const result = analyzeMediaPerformance(posts)!
    expect(result.withVideo.postCount).toBe(0)
    expect(result.videoBoost).toBe(1.0) // no videos → default 1.0
  })
})
