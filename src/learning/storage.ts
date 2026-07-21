import type { CollectedPost, LearnedInsights } from "./types"
import { STORAGE_KEYS, MAX_STORED_POSTS } from "./types"

/** Safely access chrome.storage.local — returns null if unavailable. */
function getStorage(): typeof chrome.storage.local | null {
  try {
    if (
      typeof chrome !== "undefined" &&
      chrome.runtime?.id &&
      typeof chrome.storage !== "undefined" &&
      typeof chrome.storage.local !== "undefined"
    ) {
      return chrome.storage.local
    }
  } catch {
    // Extension context invalidated
  }
  return null
}

// --- User Handle ---

export async function loadUserHandle(): Promise<string | null> {
  const storage = getStorage()
  if (!storage) return null
  return new Promise((resolve) => {
    storage.get(STORAGE_KEYS.USER_HANDLE, (result) => {
      resolve((result[STORAGE_KEYS.USER_HANDLE] as string) ?? null)
    })
  })
}

export async function saveUserHandle(handle: string): Promise<void> {
  const storage = getStorage()
  if (!storage) return
  return new Promise((resolve) => {
    storage.set({ [STORAGE_KEYS.USER_HANDLE]: handle }, resolve)
  })
}

// --- Collected Posts ---

export async function loadCollectedPosts(): Promise<CollectedPost[]> {
  const storage = getStorage()
  if (!storage) return []
  return new Promise((resolve) => {
    storage.get(STORAGE_KEYS.COLLECTED_POSTS, (result) => {
      resolve((result[STORAGE_KEYS.COLLECTED_POSTS] as CollectedPost[]) ?? [])
    })
  })
}

export async function saveCollectedPosts(posts: CollectedPost[]): Promise<void> {
  const storage = getStorage()
  if (!storage) return
  // Enforce cap: keep most recent posts
  const capped = posts.length > MAX_STORED_POSTS
    ? posts.slice(posts.length - MAX_STORED_POSTS)
    : posts
  return new Promise((resolve) => {
    storage.set({ [STORAGE_KEYS.COLLECTED_POSTS]: capped }, resolve)
  })
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
export function normalizeInsights(raw: Partial<LearnedInsights>): LearnedInsights {
  return {
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
    mediaPerformance: raw.mediaPerformance ?? null,
    recommendations: raw.recommendations ?? [],
    hookTypeBoosts: raw.hookTypeBoosts ?? {},
    optimalLengthRange: raw.optimalLengthRange ?? null
  }
}

export async function loadLearnedInsights(): Promise<LearnedInsights | null> {
  const storage = getStorage()
  if (!storage) return null
  return new Promise((resolve) => {
    storage.get(STORAGE_KEYS.LEARNED_INSIGHTS, (result) => {
      const raw = result[STORAGE_KEYS.LEARNED_INSIGHTS] as
        | Partial<LearnedInsights>
        | undefined
      resolve(raw ? normalizeInsights(raw) : null)
    })
  })
}

export async function saveLearnedInsights(
  insights: LearnedInsights
): Promise<void> {
  const storage = getStorage()
  if (!storage) return
  return new Promise((resolve) => {
    storage.set({ [STORAGE_KEYS.LEARNED_INSIGHTS]: insights }, resolve)
  })
}

// --- Clearing ---

export async function clearAllLearningData(): Promise<void> {
  const storage = getStorage()
  if (!storage) return
  return new Promise((resolve) => {
    storage.remove(
      [
        STORAGE_KEYS.USER_HANDLE,
        STORAGE_KEYS.COLLECTED_POSTS,
        STORAGE_KEYS.LEARNED_INSIGHTS
      ],
      resolve
    )
  })
}
