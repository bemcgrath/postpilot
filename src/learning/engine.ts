import type { CollectedPost, LearnedInsights } from "./types"
import type { HookTypeName } from "~scoring/types"

import { MIN_POSTS_FOR_LEARNING, MIN_ORIGINALS_FOR_LEARNING } from "./types"
import { partitionPosts } from "./segment"
import {
  loadCollectedPosts,
  loadLearnedInsights,
  saveLearnedInsights
} from "./storage"
import {
  analyzeHookTypePerformance,
  smoothHookTypeBoosts
} from "./algorithms/hook-type-learner"
import { analyzeLengthPerformance } from "./algorithms/length-learner"
import { analyzeTopicPerformance } from "./algorithms/topic-learner"
import { analyzeTimePerformance } from "./algorithms/time-learner"
import { analyzeMediaPerformance } from "./algorithms/media-learner"
import { analyzeReplyCraft } from "./algorithms/reply-craft-learner"
import { generateRecommendations } from "./recommendations"

/**
 * Run the full learning engine on collected posts.
 * Pure computation — no side effects other than reading/writing storage.
 */
export async function runLearningEngine(): Promise<LearnedInsights> {
  const posts = await loadCollectedPosts()
  const previousInsights = await loadLearnedInsights()

  const insights = computeInsights(posts, previousInsights)

  await saveLearnedInsights(insights)
  return insights
}

/**
 * Compute insights from posts (pure function, testable without storage).
 */
export function computeInsights(
  posts: CollectedPost[],
  previousInsights: LearnedInsights | null
): LearnedInsights {
  const { originals, replies, unknown } = partitionPosts(posts)
  const postsAnalyzed = posts.length
  const isReady = postsAnalyzed >= MIN_POSTS_FOR_LEARNING

  // Baseline ER: median of ALL posts (more robust than mean) -- this is the
  // displayed value, kept as-is for AnalyticsTab. The analyzers below use a
  // segment-specific baseline instead; that swap is the actual fix.
  const baselineEngagementRate = computeBaselineER(posts)

  if (!isReady) {
    return {
      insightsVersion: 2,
      segmentation: "blended",
      originalsAnalyzed: originals.length,
      repliesAnalyzed: replies.length,
      unknownSegmentCount: unknown.length,
      replyInsights: null,
      generatedAt: Date.now(),
      postsAnalyzed,
      baselineEngagementRate,
      isReady: false,
      hookTypePerformance: [],
      lengthPerformance: [],
      topicPerformance: [],
      timePerformance: [],
      weekdayTimePerformance: [],
      weekendTimePerformance: [],
      mediaPerformance: null,
      recommendations: [],
      hookTypeBoosts: {},
      optimalLengthRange: null
    }
  }

  // Originals run segmented once there's enough originals data; otherwise
  // fall back to the blended pool exactly as before the reply split shipped
  // -- a low-originals user loses nothing they had today.
  const segmented = originals.length >= MIN_ORIGINALS_FOR_LEARNING
  const corpus = segmented ? originals : posts
  const corpusBaseline = computeBaselineER(corpus)

  // Run all 5 originals algorithms against the segment-specific corpus
  const hookTypePerformance = analyzeHookTypePerformance(
    corpus,
    corpusBaseline
  )
  const { buckets: lengthPerformance, optimalRange } =
    analyzeLengthPerformance(corpus, corpusBaseline)
  const topicPerformance = analyzeTopicPerformance(corpus, corpusBaseline)
  // All-days blended (used as a low-data fallback -- see below).
  const timePerformance = analyzeTimePerformance(corpus, corpusBaseline)
  // Best-time-to-post genuinely differs between weekdays and weekends for
  // most accounts, and blending all seven days into one figure hides that.
  // Split first, then reuse the same per-hour analyzer on each subset.
  // Filtered from `corpus`, not `posts`: best-time-to-post should reflect
  // when your own originals land, not when the parents you replied to did.
  const weekdayPosts = corpus.filter((p) => !isWeekendPost(p.postedAt))
  const weekendPosts = corpus.filter((p) => isWeekendPost(p.postedAt))
  const weekdayTimePerformance = analyzeTimePerformance(
    weekdayPosts,
    corpusBaseline
  )
  const weekendTimePerformance = analyzeTimePerformance(
    weekendPosts,
    corpusBaseline
  )
  const mediaPerformance = analyzeMediaPerformance(corpus)

  // Build hook type boosts and smooth against previous
  const rawBoosts: Partial<Record<HookTypeName, number>> = {}
  for (const perf of hookTypePerformance) {
    rawBoosts[perf.hookType] = perf.boostMultiplier
  }
  const hookTypeBoosts = smoothHookTypeBoosts(
    rawBoosts,
    previousInsights?.hookTypeBoosts
  )

  // Generate recommendations
  const recommendations = generateRecommendations({
    hookTypePerf: hookTypePerformance,
    lengthPerf: lengthPerformance,
    timePerf: timePerformance,
    mediaPerf: mediaPerformance,
    topicPerf: topicPerformance
  })

  // Reply craft is computed independently of the originals branch above and
  // is strictly additive -- a thin-originals, heavy-replier account still
  // gets full reply guidance even while originals stay blended.
  const rawReplyInsights = analyzeReplyCraft(replies)
  const replyInsights = rawReplyInsights
    ? {
        ...rawReplyInsights,
        hookTypeBoosts: smoothHookTypeBoosts(
          rawReplyInsights.hookTypeBoosts,
          previousInsights?.replyInsights?.hookTypeBoosts
        )
      }
    : null

  return {
    insightsVersion: 2,
    segmentation: segmented ? "segmented" : "blended",
    originalsAnalyzed: originals.length,
    repliesAnalyzed: replies.length,
    unknownSegmentCount: unknown.length,
    replyInsights,
    generatedAt: Date.now(),
    postsAnalyzed,
    baselineEngagementRate,
    isReady: true,
    hookTypePerformance,
    lengthPerformance,
    topicPerformance,
    timePerformance,
    weekdayTimePerformance,
    weekendTimePerformance,
    mediaPerformance,
    recommendations,
    hookTypeBoosts,
    optimalLengthRange: optimalRange
  }
}

/** Saturday/Sunday by local time, matching how postedAt is grouped by hour elsewhere. */
function isWeekendPost(postedAt: number): boolean {
  const day = new Date(postedAt).getDay()
  return day === 0 || day === 6
}

/** Compute baseline ER as median of all post engagement rates. */
export function computeBaselineER(posts: CollectedPost[]): number {
  if (posts.length === 0) return 0
  const sorted = posts.map((p) => p.engagementRate).sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}
