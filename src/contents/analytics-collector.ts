import type { PlasmoCSConfig } from "plasmo"

// Suppress "Extension context invalidated" errors from dead contexts after reload
window.addEventListener("error", (event) => {
  if (event.message?.includes("Extension context invalidated")) {
    event.preventDefault()
    event.stopImmediatePropagation()
  }
})
window.addEventListener("unhandledrejection", (event) => {
  if ((event.reason as Error)?.message?.includes("Extension context invalidated")) {
    event.preventDefault()
  }
})

import type { CollectedPost } from "~learning/types"
import { collectFromArticle } from "~learning/collector"
import { detectUserHandle } from "~learning/user-detector"
import { upsertCollectedPosts, loadLearnedInsights } from "~learning/storage"
import { runLearningEngine } from "~learning/engine"

export const config: PlasmoCSConfig = {
  matches: ["https://x.com/*", "https://twitter.com/*"],
  run_at: "document_idle"
}

/** Check if extension context is still valid. */
function isContextValid(): boolean {
  try {
    return !!(chrome?.runtime?.id)
  } catch {
    return false
  }
}

/** Debounce interval for processing observed mutations (ms). */
const PROCESS_DEBOUNCE_MS = 2000

/** Flush interval for writing to storage (ms). */
const FLUSH_INTERVAL_MS = 5000

/**
 * Minimum time between learning-engine recalculations (ms). Previously
 * insights only updated when the user manually clicked "Re-run Learning"
 * in Options, so things like the best-time-to-post badge could sit
 * unchanged for weeks even as new posts kept getting collected.
 */
const RECALC_INTERVAL_MS = 24 * 60 * 60 * 1000

/** Pending posts waiting to be flushed to storage. */
let pendingPosts: CollectedPost[] = []

/** Set of tweet IDs already processed in this page session. */
const processedIds = new Set<string>()

/** Cached user handle. */
let userHandle: string | null = null

/** Reference to observer so we can disconnect on invalidation. */
let observer: MutationObserver | null = null
let flushIntervalId: ReturnType<typeof setInterval> | null = null

/** Tear down everything when extension context is invalidated. */
function teardown() {
  if (observer) { observer.disconnect(); observer = null }
  if (flushIntervalId) { clearInterval(flushIntervalId); flushIntervalId = null }
}

/** Process all visible tweet articles on the page. */
function processTweetArticles() {
  if (!isContextValid()) { teardown(); return }
  if (!userHandle) return

  const articles = document.querySelectorAll('article[data-testid="tweet"]')
  for (const article of articles) {
    try {
      // Quick check: skip if we already extracted the tweet ID from this element
      const timeEl = article.querySelector("time")
      const link = timeEl?.closest("a")
      const href = link?.getAttribute("href") || ""
      const idMatch = href.match(/\/status\/(\d+)/)
      if (idMatch && processedIds.has(idMatch[1])) continue

      const post = collectFromArticle(article, userHandle)
      if (post && !processedIds.has(post.tweetId)) {
        processedIds.add(post.tweetId)
        pendingPosts.push(post)
      }
    } catch {
      // Skip individual article errors
    }
  }
}

/** Flush pending posts to chrome.storage. */
async function flushToStorage() {
  if (!isContextValid()) { teardown(); return }
  if (pendingPosts.length === 0) return
  const batch = pendingPosts.splice(0)
  try {
    await upsertCollectedPosts(batch)
    // Fire-and-forget: only new data could change the computed insights,
    // so only bother checking staleness right after a successful flush.
    maybeRecalculateInsights()
  } catch {
    // If context invalidated, just drop — don't re-queue endlessly
    if (isContextValid()) {
      pendingPosts.unshift(...batch)
    }
  }
}

/** Re-run the learning engine if it's been a while since the last calculation. */
async function maybeRecalculateInsights() {
  if (!isContextValid()) return
  try {
    const insights = await loadLearnedInsights()
    const staleOrMissing =
      !insights || Date.now() - insights.generatedAt >= RECALC_INTERVAL_MS
    if (staleOrMissing) {
      await runLearningEngine()
    }
  } catch {
    // Best-effort — never let this break post collection.
  }
}

/** Initialize the collector. */
async function init() {
  if (!isContextValid()) return

  // Detect user handle
  userHandle = await detectUserHandle()
  if (!userHandle) {
    // Retry once after a delay (page may still be loading)
    setTimeout(async () => {
      if (!isContextValid()) return
      userHandle = await detectUserHandle()
      if (userHandle) startObserving()
    }, 3000)
    return
  }
  startObserving()
}

function startObserving() {
  // Process existing articles on page
  processTweetArticles()

  // Set up debounced MutationObserver
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  observer = new MutationObserver(() => {
    if (!isContextValid()) { teardown(); return }
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(processTweetArticles, PROCESS_DEBOUNCE_MS)
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true
  })

  // Periodic storage flush
  flushIntervalId = setInterval(flushToStorage, FLUSH_INTERVAL_MS)

  // Flush on page unload
  window.addEventListener("beforeunload", () => {
    flushToStorage()
  })
}

// Start
init()
