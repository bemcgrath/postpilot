import type { CollectedPost, HookTypePerformance } from "../types"
import type { HookTypeName } from "~scoring/types"

/** Minimum posts per hook type to include in results. */
const MIN_POSTS_PER_TYPE = 3

/** Max example posts to keep per type. */
const MAX_EXAMPLES = 3

/** Clamp a boost multiplier to the valid range. */
function clampBoost(value: number): number {
  return Math.max(0.5, Math.min(2.0, value))
}

/**
 * Analyze hook type performance from collected posts.
 * Groups by hookType, calculates avgER and boost multiplier.
 */
export function analyzeHookTypePerformance(
  posts: CollectedPost[],
  baselineER: number
): HookTypePerformance[] {
  if (baselineER <= 0) return []

  // Group by hook type
  const groups = new Map<HookTypeName, CollectedPost[]>()
  for (const post of posts) {
    if (!post.hookType) continue
    const group = groups.get(post.hookType) ?? []
    group.push(post)
    groups.set(post.hookType, group)
  }

  const results: HookTypePerformance[] = []

  for (const [hookType, typePosts] of groups) {
    if (typePosts.length < MIN_POSTS_PER_TYPE) continue

    const avgER =
      typePosts.reduce((sum, p) => sum + p.engagementRate, 0) /
      typePosts.length
    const boostMultiplier = clampBoost(avgER / baselineER)

    // Top examples by ER
    const sorted = [...typePosts].sort(
      (a, b) => b.engagementRate - a.engagementRate
    )
    const topExamples = sorted.slice(0, MAX_EXAMPLES).map((p) => ({
      tweetId: p.tweetId,
      text: p.text.length > 100 ? p.text.slice(0, 100) + "..." : p.text,
      er: p.engagementRate
    }))

    results.push({
      hookType,
      postCount: typePosts.length,
      avgER,
      boostMultiplier,
      topExamples
    })
  }

  return results.sort((a, b) => b.boostMultiplier - a.boostMultiplier)
}

/**
 * Apply EMA smoothing against previous hook type boosts.
 * newWeight = 0.3, oldWeight = 0.7
 */
export function smoothHookTypeBoosts(
  current: Partial<Record<HookTypeName, number>>,
  previous: Partial<Record<HookTypeName, number>> | undefined
): Partial<Record<HookTypeName, number>> {
  if (!previous) return current

  const smoothed: Partial<Record<HookTypeName, number>> = {}
  const allTypes = new Set([
    ...Object.keys(current),
    ...Object.keys(previous)
  ]) as Set<HookTypeName>

  for (const type of allTypes) {
    const curr = current[type]
    const prev = previous[type]
    if (curr != null && prev != null) {
      smoothed[type] = clampBoost(0.3 * curr + 0.7 * prev)
    } else if (curr != null) {
      smoothed[type] = curr
    }
    // Drop types that only existed in previous (not enough recent data)
  }

  return smoothed
}
