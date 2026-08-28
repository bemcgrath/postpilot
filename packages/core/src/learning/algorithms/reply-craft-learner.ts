import type { CollectedPost, ReplyCraftInsights } from "../types"
import type { HookTypeName } from "../../scoring/types"

import { MIN_REPLIES_FOR_LEARNING } from "../types"
import { scoreReplyCraft, stripLeadingHandles } from "../../scoring/reply-craft"
import { analyzeHookTypePerformance } from "./hook-type-learner"
import { analyzeLengthPerformance } from "./length-learner"

const TOP_COUNT = 5
const LOW_COUNT = 3
const MAX_EXAMPLE_LEN = 100

/** Reply-specific length buckets -- the originals' 0-100 first bucket would swallow nearly every reply. */
const REPLY_LENGTH_BUCKETS: Array<{ label: string; min: number; max: number }> = [
  { label: "0-40", min: 0, max: 40 },
  { label: "40-80", min: 40, max: 80 },
  { label: "80-130", min: 80, max: 130 },
  { label: "130-200", min: 130, max: 200 },
  { label: "200-280", min: 200, max: 280 },
  { label: "280+", min: 280, max: Infinity }
]

/** Duplicated from engine.ts's computeBaselineER rather than imported, to keep
 *  this a leaf module like its sibling algorithms (none of which import engine.ts). */
function medianER(posts: CollectedPost[]): number {
  if (posts.length === 0) return 0
  const sorted = posts.map((p) => p.engagementRate).sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

function truncate(text: string): string {
  return text.length > MAX_EXAMPLE_LEN ? text.slice(0, MAX_EXAMPLE_LEN) + "..." : text
}

function share(flags: boolean[]): number {
  return flags.length > 0 ? flags.filter(Boolean).length / flags.length : 0
}

/**
 * Learn reply craft from a user's own reply history. Returns null below
 * MIN_REPLIES_FOR_LEARNING -- the compose box falls back to config defaults
 * until then. hookTypeBoosts here are raw/unsmoothed; engine.ts smooths them
 * against previousInsights.replyInsights.hookTypeBoosts, the same separation
 * of concerns as the originals' boosts.
 */
export function analyzeReplyCraft(replies: CollectedPost[]): ReplyCraftInsights | null {
  if (replies.length < MIN_REPLIES_FOR_LEARNING) return null

  const baselineEngagementRate = medianER(replies)
  const sorted = [...replies].sort((a, b) => b.engagementRate - a.engagementRate)
  const top = sorted.slice(0, TOP_COUNT)
  const low = sorted.slice(-LOW_COUNT).reverse()

  const { buckets: lengthPerformance } = analyzeLengthPerformance(
    replies,
    baselineEngagementRate,
    REPLY_LENGTH_BUCKETS
  )

  const hookTypePerf = analyzeHookTypePerformance(replies, baselineEngagementRate)
  const hookTypeBoosts: Partial<Record<HookTypeName, number>> = {}
  for (const perf of hookTypePerf) {
    hookTypeBoosts[perf.hookType] = perf.boostMultiplier
  }

  // Strip handles before measuring -- addressing isn't craft.
  const topStrippedLengths = top.map((p) => stripLeadingHandles(p.text).trim().length)
  const avgLen =
    topStrippedLengths.reduce((sum, n) => sum + n, 0) / topStrippedLengths.length
  const optimalLengthRange = {
    min: Math.max(40, Math.round(avgLen * 0.7)),
    max: Math.min(260, Math.round(avgLen * 1.3))
  }

  // Same predicates the live scorer uses, so learned shares and the live score never disagree.
  const topScored = top.map((p) => scoreReplyCraft(p.text))
  const lowScored = low.map((p) => scoreReplyCraft(p.text))
  const craftSignals = {
    multiSentenceShare: share(topScored.map((s) => s.signals.includes("multi-sentence"))),
    mechanismShare: share(topScored.map((s) => s.signals.includes("mechanism"))),
    specificityShare: share(topScored.map((s) => s.signals.includes("specificity"))),
    praiseOnlyShareLow: share(lowScored.map((s) => s.antiSignals.includes("praise-only")))
  }

  const topExamples = top.map((p) => ({
    tweetId: p.tweetId,
    text: truncate(stripLeadingHandles(p.text)),
    er: p.engagementRate
  }))
  const lowExamples = low.map((p) => ({
    tweetId: p.tweetId,
    text: truncate(stripLeadingHandles(p.text)),
    er: p.engagementRate
  }))

  const recommendation =
    `Top replies avg ~${Math.round(avgLen)} chars. ` +
    `${Math.round(craftSignals.mechanismShare * 100)}% of winners use mechanism/constraint language. ` +
    `${Math.round(craftSignals.multiSentenceShare * 100)}% of winners use 2+ sentences. ` +
    `Avoid short praise-only replies (see low examples).`

  return {
    repliesAnalyzed: replies.length,
    baselineEngagementRate,
    optimalLengthRange,
    lengthPerformance,
    hookTypeBoosts,
    craftSignals,
    topExamples,
    lowExamples,
    recommendation
  }
}
