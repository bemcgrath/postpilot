import type {
  HookTypePerformance,
  LengthPerformance,
  TimePerformance,
  MediaPerformance,
  TopicPerformance,
  Recommendation
} from "./types"

import { humanizeHookType } from "~scoring/hook-types"

/** Minimum boost multiplier to generate a recommendation. */
const HOOK_BOOST_THRESHOLD = 1.3
const LENGTH_BOOST_THRESHOLD = 1.2
const TIME_BOOST_THRESHOLD = 1.3
const IMAGE_BOOST_THRESHOLD = 1.5
const TOPIC_BOOST_THRESHOLD = 1.3

/** Format a boost as "1.8x". */
function fmtBoost(n: number): string {
  return n.toFixed(1) + "x"
}

/** Format hour as "2 PM", "11 AM", etc. */
function fmtHour(hour: number): string {
  if (hour === 0) return "12 AM"
  if (hour === 12) return "12 PM"
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`
}

/**
 * Generate human-readable recommendations from learned insights.
 */
export function generateRecommendations(params: {
  hookTypePerf: HookTypePerformance[]
  lengthPerf: LengthPerformance[]
  timePerf: TimePerformance[]
  mediaPerf: MediaPerformance | null
  topicPerf: TopicPerformance[]
}): Recommendation[] {
  const recs: Recommendation[] = []

  // Hook types with strong boosts (top 3)
  const strongHooks = params.hookTypePerf.filter(
    (h) => h.boostMultiplier >= HOOK_BOOST_THRESHOLD
  )
  for (const hook of strongHooks.slice(0, 3)) {
    recs.push({
      type: "hook_type",
      text: `Your ${humanizeHookType(hook.hookType)} hooks get ${fmtBoost(hook.boostMultiplier)} vs baseline (${hook.postCount} posts)`,
      boostMultiplier: hook.boostMultiplier
    })
  }

  // Best length bucket
  const bestLength = params.lengthPerf.find(
    (l) => l.boostMultiplier >= LENGTH_BOOST_THRESHOLD
  )
  if (bestLength) {
    recs.push({
      type: "length",
      text: `Posts of ${bestLength.bucket} chars perform ${fmtBoost(bestLength.boostMultiplier)} better (${bestLength.postCount} posts)`,
      boostMultiplier: bestLength.boostMultiplier
    })
  }

  // Best posting time
  const bestTime = params.timePerf.find(
    (t) => t.boostMultiplier >= TIME_BOOST_THRESHOLD
  )
  if (bestTime) {
    recs.push({
      type: "time",
      text: `Posts at ${fmtHour(bestTime.hour)} get ${fmtBoost(bestTime.boostMultiplier)} more engagement (${bestTime.postCount} posts)`,
      boostMultiplier: bestTime.boostMultiplier
    })
  }

  // Image impact
  if (
    params.mediaPerf &&
    params.mediaPerf.imageBoost >= IMAGE_BOOST_THRESHOLD &&
    params.mediaPerf.withImage.postCount >= 2 &&
    params.mediaPerf.withoutImage.postCount >= 2
  ) {
    recs.push({
      type: "media",
      text: `Posts with images get ${fmtBoost(params.mediaPerf.imageBoost)} more engagement`,
      boostMultiplier: params.mediaPerf.imageBoost
    })
  }

  // Top topics
  const strongTopics = params.topicPerf.filter(
    (t) => t.boostMultiplier >= TOPIC_BOOST_THRESHOLD
  )
  for (const topic of strongTopics.slice(0, 2)) {
    recs.push({
      type: "topic",
      text: `"${topic.keyword}" posts get ${fmtBoost(topic.boostMultiplier)} engagement (${topic.postCount} posts)`,
      boostMultiplier: topic.boostMultiplier
    })
  }

  // Sort by boost (strongest first)
  return recs.sort((a, b) => b.boostMultiplier - a.boostMultiplier)
}
