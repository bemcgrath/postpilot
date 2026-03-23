import type { CollectedPost, TimePerformance } from "../types"

/** Minimum posts per hour to include. */
const MIN_POSTS_PER_HOUR = 2

/**
 * Analyze posting time performance.
 * Groups by hour of day (0-23), returns sorted by boost.
 */
export function analyzeTimePerformance(
  posts: CollectedPost[],
  baselineER: number
): TimePerformance[] {
  if (baselineER <= 0) return []

  // Group by hour
  const hourPosts = new Map<number, CollectedPost[]>()
  for (const post of posts) {
    const hour = new Date(post.postedAt).getHours()
    const group = hourPosts.get(hour) ?? []
    group.push(post)
    hourPosts.set(hour, group)
  }

  const results: TimePerformance[] = []

  for (const [hour, hPosts] of hourPosts) {
    if (hPosts.length < MIN_POSTS_PER_HOUR) continue

    const avgER =
      hPosts.reduce((sum, p) => sum + p.engagementRate, 0) / hPosts.length
    const boostMultiplier = Math.max(0.5, Math.min(2.0, avgER / baselineER))

    results.push({
      hour,
      postCount: hPosts.length,
      avgER,
      boostMultiplier
    })
  }

  return results.sort((a, b) => b.boostMultiplier - a.boostMultiplier)
}
