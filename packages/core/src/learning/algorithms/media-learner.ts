import type { CollectedPost, MediaPerformance } from "../types"

/**
 * Analyze media impact on engagement.
 * Compares with-image vs without, with-video vs without, with-link vs without.
 * Image and video are partitioned separately -- X's own ranking algorithm
 * weights a video open differently from a photo expand, so folding them
 * into one bucket would throw away a real, already-collected signal
 * (CollectedPost.hasVideo).
 */
export function analyzeMediaPerformance(
  posts: CollectedPost[]
): MediaPerformance | null {
  if (posts.length < 5) return null

  const withImage = posts.filter((p) => p.hasImage)
  const withoutImage = posts.filter((p) => !p.hasImage)
  const withVideo = posts.filter((p) => p.hasVideo)
  const withoutVideo = posts.filter((p) => !p.hasVideo)
  const withLink = posts.filter((p) => p.hasLink)
  const withoutLink = posts.filter((p) => !p.hasLink)

  const avgER = (arr: CollectedPost[]) =>
    arr.length > 0
      ? arr.reduce((sum, p) => sum + p.engagementRate, 0) / arr.length
      : 0

  const withImageER = avgER(withImage)
  const withoutImageER = avgER(withoutImage)
  const withVideoER = avgER(withVideo)
  const withoutVideoER = avgER(withoutVideo)
  const withLinkER = avgER(withLink)
  const withoutLinkER = avgER(withoutLink)

  const ratioBoost = (
    withArr: CollectedPost[],
    withoutArr: CollectedPost[],
    withER: number,
    withoutER: number
  ): number =>
    withArr.length === 0 || withoutArr.length === 0
      ? 1.0
      : withoutER > 0
        ? withER / withoutER
        : withER > 0 ? 2.0 : 1.0

  const imageBoost = ratioBoost(withImage, withoutImage, withImageER, withoutImageER)
  const videoBoost = ratioBoost(withVideo, withoutVideo, withVideoER, withoutVideoER)
  const linkBoost = ratioBoost(withLink, withoutLink, withLinkER, withoutLinkER)

  return {
    withImage: { postCount: withImage.length, avgER: withImageER },
    withoutImage: { postCount: withoutImage.length, avgER: withoutImageER },
    imageBoost,
    withVideo: { postCount: withVideo.length, avgER: withVideoER },
    withoutVideo: { postCount: withoutVideo.length, avgER: withoutVideoER },
    videoBoost,
    withLink: { postCount: withLink.length, avgER: withLinkER },
    withoutLink: { postCount: withoutLink.length, avgER: withoutLinkER },
    linkBoost
  }
}
