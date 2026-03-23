import type { CollectedPost, MediaPerformance } from "../types"

/**
 * Analyze media impact on engagement.
 * Compares with-image vs without, with-link vs without.
 */
export function analyzeMediaPerformance(
  posts: CollectedPost[]
): MediaPerformance | null {
  if (posts.length < 5) return null

  const withImage = posts.filter((p) => p.hasImage)
  const withoutImage = posts.filter((p) => !p.hasImage)
  const withLink = posts.filter((p) => p.hasLink)
  const withoutLink = posts.filter((p) => !p.hasLink)

  const avgER = (arr: CollectedPost[]) =>
    arr.length > 0
      ? arr.reduce((sum, p) => sum + p.engagementRate, 0) / arr.length
      : 0

  const withImageER = avgER(withImage)
  const withoutImageER = avgER(withoutImage)
  const withLinkER = avgER(withLink)
  const withoutLinkER = avgER(withoutLink)

  const imageBoost =
    withImage.length === 0 || withoutImage.length === 0
      ? 1.0
      : withoutImageER > 0
        ? withImageER / withoutImageER
        : withImageER > 0 ? 2.0 : 1.0

  const linkBoost =
    withLink.length === 0 || withoutLink.length === 0
      ? 1.0
      : withoutLinkER > 0
        ? withLinkER / withoutLinkER
        : withLinkER > 0 ? 2.0 : 1.0

  return {
    withImage: { postCount: withImage.length, avgER: withImageER },
    withoutImage: { postCount: withoutImage.length, avgER: withoutImageER },
    imageBoost,
    withLink: { postCount: withLink.length, avgER: withLinkER },
    withoutLink: { postCount: withoutLink.length, avgER: withoutLinkER },
    linkBoost
  }
}
