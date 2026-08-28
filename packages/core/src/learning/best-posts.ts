import type { CollectedPost } from "./types"
import { MIN_POSTS_FOR_LEARNING } from "./types"
import { computeBaselineER } from "./engine"
import { segmentOf } from "./segment"

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
 * of a bad bunch" as if it were a real signal. Replies are excluded: they're
 * reactive/contextual responses to someone else's post rather than the
 * user's own standalone voice, so importing them risks skewing the
 * fingerprint even when they happened to perform well. Replies still feed
 * the rest of the learning engine -- best-time, hook-type boosts, and their
 * own dedicated replyInsights -- this exclusion is specific to sample-post
 * import.
 *
 * Uses segmentOf() === "original" rather than !post.isReply: posts collected
 * before reply detection existed have no isReply field at all (undefined),
 * and `!undefined` is true, which would silently let old replies back in.
 * segmentOf treats that case as "unknown", which is excluded here the same
 * as a confirmed reply, until the post is re-scraped and isReply backfills
 * automatically the next time upsertCollectedPosts sees the same tweetId.
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
        segmentOf(p) === "original" &&
        !alreadyImportedTweetIds.has(p.tweetId) &&
        p.engagementRate > baseline
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
