import type { CollectedPost, LengthPerformance } from "../types"

/** Length bucket definitions. */
const BUCKETS: Array<{ label: string; min: number; max: number }> = [
  { label: "0-100", min: 0, max: 100 },
  { label: "100-200", min: 100, max: 200 },
  { label: "200-280", min: 200, max: 280 },
  { label: "280-320", min: 280, max: 320 },
  { label: "320-400", min: 320, max: 400 },
  { label: "400+", min: 400, max: Infinity }
]

/**
 * Analyze post performance by character length buckets.
 * Returns performance per bucket and optimal length range.
 */
export function analyzeLengthPerformance(
  posts: CollectedPost[],
  baselineER: number
): {
  buckets: LengthPerformance[]
  optimalRange: { min: number; max: number } | null
} {
  if (baselineER <= 0) return { buckets: [], optimalRange: null }

  const bucketPosts = new Map<string, CollectedPost[]>()
  for (const bucket of BUCKETS) {
    bucketPosts.set(bucket.label, [])
  }

  // Assign posts to buckets
  for (const post of posts) {
    for (const bucket of BUCKETS) {
      if (post.charCount >= bucket.min && post.charCount < bucket.max) {
        bucketPosts.get(bucket.label)!.push(post)
        break
      }
    }
  }

  const results: LengthPerformance[] = []
  let bestBucket: LengthPerformance | null = null

  for (const bucket of BUCKETS) {
    const bPosts = bucketPosts.get(bucket.label)!
    if (bPosts.length === 0) continue

    const avgER =
      bPosts.reduce((sum, p) => sum + p.engagementRate, 0) / bPosts.length
    const boostMultiplier = Math.max(0.5, Math.min(2.0, avgER / baselineER))

    const perf: LengthPerformance = {
      bucket: bucket.label,
      min: bucket.min,
      max: bucket.max === Infinity ? 999 : bucket.max,
      postCount: bPosts.length,
      avgER,
      boostMultiplier
    }
    results.push(perf)

    if (
      perf.postCount >= 2 &&
      (!bestBucket || perf.avgER > bestBucket.avgER)
    ) {
      bestBucket = perf
    }
  }

  const optimalRange = bestBucket
    ? { min: bestBucket.min, max: bestBucket.max }
    : null

  return { buckets: results, optimalRange }
}
