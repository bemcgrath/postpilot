import type { CollectedPost, LearnedInsights } from "./types"
import { STORAGE_KEYS, MAX_STORED_POSTS } from "./types"
import {
  EMPTY_FUNNEL,
  mergeSkipIds,
  summarizeFunnel,
  type CollectionFunnelSnapshot,
  type OwnPostSkip,
  type StoredFunnel
} from "./funnel"
import { getStore } from "../storage/adapter"

// --- User Handle ---

export async function loadUserHandle(): Promise<string | null> {
  const storage = getStore()
  if (!storage) return null
  const result = await storage.get(STORAGE_KEYS.USER_HANDLE)
  return (result[STORAGE_KEYS.USER_HANDLE] as string) ?? null
}

export async function saveUserHandle(handle: string): Promise<void> {
  const storage = getStore()
  if (!storage) return
  await storage.set({ [STORAGE_KEYS.USER_HANDLE]: handle })
}

// --- Collected Posts ---

export async function loadCollectedPosts(): Promise<CollectedPost[]> {
  const storage = getStore()
  if (!storage) return []
  const result = await storage.get(STORAGE_KEYS.COLLECTED_POSTS)
  return (result[STORAGE_KEYS.COLLECTED_POSTS] as CollectedPost[]) ?? []
}

export async function saveCollectedPosts(posts: CollectedPost[]): Promise<void> {
  const storage = getStore()
  if (!storage) return
  // Enforce cap: keep most recent posts
  const capped = posts.length > MAX_STORED_POSTS
    ? posts.slice(posts.length - MAX_STORED_POSTS)
    : posts
  await storage.set({ [STORAGE_KEYS.COLLECTED_POSTS]: capped })
}

/**
 * Upsert posts by tweetId — updates metrics if seen again, inserts if new.
 * Returns the merged list.
 */
export async function upsertCollectedPosts(
  newPosts: CollectedPost[]
): Promise<CollectedPost[]> {
  const existing = await loadCollectedPosts()
  const byId = new Map(existing.map((p) => [p.tweetId, p]))

  for (const post of newPosts) {
    const prev = byId.get(post.tweetId)
    if (prev) {
      // Update with newer metrics (higher collectedAt = more recent scrape)
      if (post.collectedAt > prev.collectedAt) {
        byId.set(post.tweetId, { ...prev, ...post })
      }
    } else {
      byId.set(post.tweetId, post)
    }
  }

  const merged = Array.from(byId.values()).sort(
    (a, b) => a.postedAt - b.postedAt
  )
  await saveCollectedPosts(merged)
  return merged
}

// --- Learned Insights ---

/**
 * Fill in any fields missing from a stored insights object with safe
 * defaults. The LearnedInsights shape has grown new fields several times
 * during development (most recently weekday/weekend time splits); without
 * this, insights cached by an older version crash every consumer that
 * calls .length/.map on a field that simply didn't exist yet when that
 * object was computed and persisted.
 */
/**
 * Backfill a stored MediaPerformance with the video split added after it may
 * have been persisted -- a stored object from before that change has
 * withImage/withoutImage/imageBoost and withLink/withoutLink/linkBoost, but
 * no withVideo/withoutVideo/videoBoost yet. Defaults match "no video data
 * either way" (postCount 0, videoBoost 1.0 = no learned effect).
 */
function normalizeMediaPerformance(
  raw: LearnedInsights["mediaPerformance"]
): LearnedInsights["mediaPerformance"] {
  if (!raw) return null
  return {
    ...raw,
    withVideo: raw.withVideo ?? { postCount: 0, avgER: 0 },
    withoutVideo: raw.withoutVideo ?? { postCount: 0, avgER: 0 },
    videoBoost: raw.videoBoost ?? 1.0
  }
}

export function normalizeInsights(raw: Partial<LearnedInsights>): LearnedInsights {
  return {
    insightsVersion: raw.insightsVersion ?? 1,
    segmentation: raw.segmentation ?? "blended",
    originalsAnalyzed: raw.originalsAnalyzed ?? 0,
    repliesAnalyzed: raw.repliesAnalyzed ?? 0,
    unknownSegmentCount: raw.unknownSegmentCount ?? 0,
    replyInsights: raw.replyInsights ?? null,
    generatedAt: raw.generatedAt ?? 0,
    postsAnalyzed: raw.postsAnalyzed ?? 0,
    baselineEngagementRate: raw.baselineEngagementRate ?? 0,
    isReady: raw.isReady ?? false,
    hookTypePerformance: raw.hookTypePerformance ?? [],
    lengthPerformance: raw.lengthPerformance ?? [],
    topicPerformance: raw.topicPerformance ?? [],
    timePerformance: raw.timePerformance ?? [],
    weekdayTimePerformance: raw.weekdayTimePerformance ?? [],
    weekendTimePerformance: raw.weekendTimePerformance ?? [],
    mediaPerformance: normalizeMediaPerformance(raw.mediaPerformance ?? null),
    recommendations: raw.recommendations ?? [],
    hookTypeBoosts: raw.hookTypeBoosts ?? {},
    optimalLengthRange: raw.optimalLengthRange ?? null
  }
}

export async function loadLearnedInsights(): Promise<LearnedInsights | null> {
  const storage = getStore()
  if (!storage) return null
  const result = await storage.get(STORAGE_KEYS.LEARNED_INSIGHTS)
  const raw = result[STORAGE_KEYS.LEARNED_INSIGHTS] as
    | Partial<LearnedInsights>
    | undefined
  return raw ? normalizeInsights(raw) : null
}

export async function saveLearnedInsights(
  insights: LearnedInsights
): Promise<void> {
  const storage = getStore()
  if (!storage) return
  await storage.set({ [STORAGE_KEYS.LEARNED_INSIGHTS]: insights })
}

// --- Collection funnel ---

export async function loadStoredFunnel(): Promise<StoredFunnel> {
  const storage = getStore()
  if (!storage) return { ...EMPTY_FUNNEL }
  const result = await storage.get(STORAGE_KEYS.COLLECTION_FUNNEL)
  const raw = result[STORAGE_KEYS.COLLECTION_FUNNEL] as StoredFunnel | undefined
  return {
    waitingOnAgeIds: Array.isArray(raw?.waitingOnAgeIds) ? raw.waitingOnAgeIds : [],
    missingImpressionIds: Array.isArray(raw?.missingImpressionIds)
      ? raw.missingImpressionIds
      : []
  }
}

export async function recordOwnPostSkips(skips: OwnPostSkip[]): Promise<void> {
  if (skips.length === 0) return
  const storage = getStore()
  if (!storage) return
  const stored = await loadStoredFunnel()
  const merged = mergeSkipIds(stored, skips)
  await storage.set({ [STORAGE_KEYS.COLLECTION_FUNNEL]: merged })
}

export async function loadFunnelSnapshot(): Promise<CollectionFunnelSnapshot> {
  const [handle, posts, stored] = await Promise.all([
    loadUserHandle(),
    loadCollectedPosts(),
    loadStoredFunnel()
  ])
  return summarizeFunnel({
    handle,
    posts,
    waitingOnAgeIds: stored.waitingOnAgeIds,
    missingImpressionIds: stored.missingImpressionIds
  })
}

// --- Clearing ---

export async function clearAllLearningData(): Promise<void> {
  const storage = getStore()
  if (!storage) return
  await storage.remove([
    STORAGE_KEYS.USER_HANDLE,
    STORAGE_KEYS.COLLECTED_POSTS,
    STORAGE_KEYS.LEARNED_INSIGHTS,
    STORAGE_KEYS.COLLECTION_FUNNEL
  ])
}
