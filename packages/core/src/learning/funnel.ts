import type { CollectedPost } from "./types"
import { MIN_POSTS_FOR_LEARNING } from "./types"

/** Tweet IDs skipped during DOM collection, used to explain an empty funnel. */
export interface StoredFunnel {
  waitingOnAgeIds: string[]
  missingImpressionIds: string[]
}

export const EMPTY_FUNNEL: StoredFunnel = {
  waitingOnAgeIds: [],
  missingImpressionIds: []
}

const MAX_SKIP_IDS = 80

export type OwnPostSkipReason = "too_new" | "no_impressions"

export interface OwnPostSkip {
  tweetId: string
  reason: OwnPostSkipReason
}

export interface CollectionFunnelSnapshot {
  handle: string | null
  collected: number
  needed: number
  waitingOnAge: number
  missingImpressions: number
  isReady: boolean
}

function capIds(ids: string[]): string[] {
  return ids.length > MAX_SKIP_IDS ? ids.slice(ids.length - MAX_SKIP_IDS) : ids
}

function uniqueAppend(existing: string[], id: string): string[] {
  if (existing.includes(id)) return existing
  return capIds([...existing, id])
}

/**
 * Merge newly observed skip reasons into the stored ID lists.
 * A post that later fails on impressions is no longer "waiting on age".
 */
export function mergeSkipIds(
  stored: StoredFunnel,
  skips: OwnPostSkip[]
): StoredFunnel {
  let waitingOnAgeIds = [...stored.waitingOnAgeIds]
  let missingImpressionIds = [...stored.missingImpressionIds]

  for (const skip of skips) {
    const id = skip.tweetId.trim()
    if (!id) continue
    if (skip.reason === "too_new") {
      waitingOnAgeIds = uniqueAppend(waitingOnAgeIds, id)
    } else {
      missingImpressionIds = uniqueAppend(missingImpressionIds, id)
      waitingOnAgeIds = waitingOnAgeIds.filter((x) => x !== id)
    }
  }

  return { waitingOnAgeIds: capIds(waitingOnAgeIds), missingImpressionIds: capIds(missingImpressionIds) }
}

/** Count skip IDs that are not already in the collected set. */
export function summarizeFunnel(args: {
  handle: string | null
  posts: CollectedPost[]
  waitingOnAgeIds: string[]
  missingImpressionIds: string[]
}): CollectionFunnelSnapshot {
  const collectedIds = new Set(args.posts.map((p) => p.tweetId))
  const collected = args.posts.length
  const waitingOnAge = args.waitingOnAgeIds.filter((id) => !collectedIds.has(id)).length
  const missingImpressions = args.missingImpressionIds.filter(
    (id) => !collectedIds.has(id)
  ).length

  return {
    handle: args.handle,
    collected,
    needed: MIN_POSTS_FOR_LEARNING,
    waitingOnAge,
    missingImpressions,
    isReady: collected >= MIN_POSTS_FOR_LEARNING
  }
}
