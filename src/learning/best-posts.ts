import type { CollectedPost } from "./types"
import { MIN_POSTS_FOR_LEARNING } from "./types"
import { computeBaselineER } from "./engine"

/** Cap on suggestions shown at once -- keeps the review list scannable. */
export const MAX_IMPORT_SUGGESTIONS = 10

export interface BestPostCandidate {
  tweetId: string
  text: string
  engagementRate: number
  boostMultiplier: number // engagementRate / baseline, for display (e.g. "2.1x baseline")
  impressions: number
}

/**
 * Pick collected posts worth suggesting as voice-fingerprint sample posts.
 * Requires the same data volume the learning engine itself requires before
 * "best" means anything, and only surfaces posts genuinely above the user's
 * own baseline -- otherwise a thin or weak history would suggest its "best
 * of a bad bunch" as if it were a real signal.
 */
export function selectBestPostsForImport(
  posts: CollectedPost[],
  alreadyImportedTweetIds: ReadonlySet<string>
): BestPostCandidate[] {
  if (posts.length < MIN_POSTS_FOR_LEARNING) return []

  const baseline = computeBaselineER(posts)
  if (baseline <= 0) return []

  return posts
    .filter(
      (p) =>
        !alreadyImportedTweetIds.has(p.tweetId) && p.engagementRate > baseline
    )
    .sort((a, b) => b.engagementRate - a.engagementRate)
    .slice(0, MAX_IMPORT_SUGGESTIONS)
    .map((p) => ({
      tweetId: p.tweetId,
      text: p.text,
      engagementRate: p.engagementRate,
      boostMultiplier: p.engagementRate / baseline,
      impressions: p.impressions
    }))
}
