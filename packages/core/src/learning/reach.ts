import type { CollectedPost } from "./types"
import type { HookTypeName } from "../scoring/types"

/** Don't show a range until we have this many similar posts. */
export const MIN_POSTS_FOR_REACH = 8

export interface ReachDraft {
  hookType: HookTypeName | null
  charCount: number
  isReply: boolean
}

export interface ReachRange {
  low: number
  high: number
  n: number
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

function impressionsOf(posts: CollectedPost[]): number[] {
  return posts
    .map((p) => p.impressions)
    .filter((n) => n > 0)
    .sort((a, b) => a - b)
}

function rangeFrom(values: number[]): ReachRange | null {
  if (values.length < MIN_POSTS_FOR_REACH) return null
  let low = Math.round(percentile(values, 0.25))
  let high = Math.round(percentile(values, 0.75))
  if (low === high) {
    low = values[0]
    high = values[values.length - 1]
  }
  if (low === high) return null
  return { low, high, n: values.length }
}

/**
 * Reach range from the user's own collected impressions for similar posts.
 * Never invents a single impression count. Hidden until n is honest.
 */
export function estimateReachRange(
  posts: CollectedPost[],
  draft: ReachDraft
): ReachRange | null {
  const sameSegment = posts.filter((p) => p.isReply === draft.isReply)
  const sameHook = draft.hookType
    ? sameSegment.filter((p) => p.hookType === draft.hookType)
    : []

  const fromHook = rangeFrom(impressionsOf(sameHook))
  if (fromHook) return fromHook

  const nearby = sameSegment.filter(
    (p) => Math.abs(p.charCount - draft.charCount) <= 100
  )
  return rangeFrom(impressionsOf(nearby))
}

/** Compact display like 1.2K, 48K, 1.5M. */
export function formatReach(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000
    return `${v >= 10 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, "")}M`
  }
  if (n >= 1000) {
    const v = n / 1000
    return `${v >= 10 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, "")}K`
  }
  return String(n)
}
