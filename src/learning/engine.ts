import type { CollectedPost, LearnedInsights } from "./types"
import type { HookTypeName } from "~scoring/types"

import { MIN_POSTS_FOR_LEARNING } from "./types"
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
  const postsAnalyzed = posts.length
  const isReady = postsAnalyzed >= MIN_POSTS_FOR_LEARNING

  // Baseline ER: median of all posts (more robust than mean)
  const baselineEngagementRate = computeBaselineER(posts)

  if (!isReady) {
    return {
      generatedAt: Date.now(),
      postsAnalyzed,
      baselineEngagementRate,
      isReady: false,
      hookTypePerformance: [],
      lengthPerformance: [],
      topicPerformance: [],
      timePerformance: [],
      mediaPerformance: null,
      recommendations: [],
      hookTypeBoosts: {},
      optimalLengthRange: null
    }
  }

  // Run all 5 algorithms
  const hookTypePerformance = analyzeHookTypePerformance(
    posts,
    baselineEngagementRate
  )
  const { buckets: lengthPerformance, optimalRange } =
    analyzeLengthPerformance(posts, baselineEngagementRate)
  const topicPerformance = analyzeTopicPerformance(
    posts,
    baselineEngagementRate
  )
  const timePerformance = analyzeTimePerformance(
    posts,
    baselineEngagementRate
  )
  const mediaPerformance = analyzeMediaPerformance(posts)

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

  return {
    generatedAt: Date.now(),
    postsAnalyzed,
    baselineEngagementRate,
    isReady: true,
    hookTypePerformance,
    lengthPerformance,
    topicPerformance,
    timePerformance,
    mediaPerformance,
    recommendations,
    hookTypeBoosts,
    optimalLengthRange: optimalRange
  }
}

/** Compute baseline ER as median of all post engagement rates. */
function computeBaselineER(posts: CollectedPost[]): number {
  if (posts.length === 0) return 0
  const sorted = posts.map((p) => p.engagementRate).sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}
