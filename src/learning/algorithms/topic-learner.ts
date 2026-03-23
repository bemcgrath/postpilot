import type { CollectedPost, TopicPerformance } from "../types"

/** Minimum posts per keyword to include in results. */
const MIN_POSTS_PER_KEYWORD = 3

/** Max topics to return. */
const MAX_TOPICS = 30

/**
 * Analyze topic keyword performance from collected posts.
 * Returns per-keyword ER and boost multiplier, sorted by boost.
 */
export function analyzeTopicPerformance(
  posts: CollectedPost[],
  baselineER: number
): TopicPerformance[] {
  if (baselineER <= 0) return []

  // Group posts by keyword
  const keywordPosts = new Map<string, CollectedPost[]>()
  for (const post of posts) {
    for (const keyword of post.topics) {
      const group = keywordPosts.get(keyword) ?? []
      group.push(post)
      keywordPosts.set(keyword, group)
    }
  }

  const results: TopicPerformance[] = []

  for (const [keyword, kwPosts] of keywordPosts) {
    if (kwPosts.length < MIN_POSTS_PER_KEYWORD) continue

    const avgER =
      kwPosts.reduce((sum, p) => sum + p.engagementRate, 0) / kwPosts.length
    const boostMultiplier = Math.max(0.5, Math.min(2.0, avgER / baselineER))

    results.push({
      keyword,
      postCount: kwPosts.length,
      avgER,
      boostMultiplier
    })
  }

  return results
    .sort((a, b) => b.boostMultiplier - a.boostMultiplier)
    .slice(0, MAX_TOPICS)
}
