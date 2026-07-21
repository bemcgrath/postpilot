import type { CollectedPost } from "./types"
import type { HookTypeName } from "~scoring/types"

import { extractTopics } from "./topic-extractor"
import { HookAnalyzer } from "~scoring/hook-analyzer"
import { getHookAnalyzerConfig } from "~config/config-storage"

const analyzer = new HookAnalyzer()

/** Minimum age in ms before collecting a post (24 hours). */
const MIN_AGE_MS = 24 * 60 * 60 * 1000

/**
 * Parse a compact number string like "12.3K", "1.5M", "892" into a number.
 */
export function parseCompactNumber(text: string): number {
  if (!text) return 0
  const cleaned = text.replace(/[,\s]/g, "").trim()
  const match = cleaned.match(/^([\d.]+)\s*([KkMmBb])?$/)
  if (!match) return 0
  const num = parseFloat(match[1])
  const suffix = (match[2] || "").toUpperCase()
  if (suffix === "K") return Math.round(num * 1000)
  if (suffix === "M") return Math.round(num * 1_000_000)
  if (suffix === "B") return Math.round(num * 1_000_000_000)
  return Math.round(num)
}

/**
 * Extract a metric value from an aria-label like "123 Likes" or "1.2K Retweets".
 */
function parseAriaMetric(element: Element | null): number {
  if (!element) return 0
  const label = element.getAttribute("aria-label") || ""
  const match = label.match(/([\d.,]+[KkMmBb]?)\s/)
  return match ? parseCompactNumber(match[1]) : 0
}

/**
 * Check if a tweet article belongs to the given user handle.
 */
function isOwnPost(article: Element, handle: string): boolean {
  const userNameEl = article.querySelector('[data-testid="User-Name"]')
  if (!userNameEl) return false
  const links = userNameEl.querySelectorAll("a")
  for (const link of links) {
    const href = link.getAttribute("href") || ""
    if (href.toLowerCase() === `/${handle.toLowerCase()}`) return true
  }
  return false
}

/**
 * Extract tweet ID from the timestamp link inside a tweet article.
 */
function extractTweetId(article: Element): string | null {
  const timeEl = article.querySelector("time")
  if (!timeEl) return null
  const link = timeEl.closest("a")
  if (!link) return null
  const href = link.getAttribute("href") || ""
  const match = href.match(/\/status\/(\d+)/)
  return match ? match[1] : null
}

/**
 * Extract posted timestamp from <time datetime="...">.
 */
function extractPostedAt(article: Element): number | null {
  const timeEl = article.querySelector("time")
  if (!timeEl) return null
  const datetime = timeEl.getAttribute("datetime")
  if (!datetime) return null
  const ts = new Date(datetime).getTime()
  return isNaN(ts) ? null : ts
}

/**
 * Does this tweet visibly continue a thread beneath it? X renders a short
 * vertical connector line below the avatar of a tweet that has a reply
 * shown immediately after it, and omits the "Replying to @x" text on the
 * reply itself in that case (verified live: profile "with_replies" tab
 * shows parent -> reply as adjacent cells with only the parent carrying
 * the connector, so checking "Replying to" text on the reply alone misses
 * exactly the surface this feature cares about most).
 */
function hasOutgoingThreadConnector(article: Element): boolean {
  const avatarEl = article.querySelector('[data-testid="Tweet-User-Avatar"]')
  const gutter = avatarEl?.parentElement
  if (!gutter) return false
  return Array.from(gutter.children).some((el) => {
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.width > 3) return false
    const bg = window.getComputedStyle(el).backgroundColor
    return bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent"
  })
}

/**
 * Is this tweet a reply? Two signals, since neither alone covers every
 * surface: an explicit "Replying to @x" line (shown when the parent isn't
 * rendered adjacently, e.g. home timeline out-of-context replies) or the
 * immediately preceding tweet in the DOM carrying an outgoing thread
 * connector (shown on profile/thread views where the parent IS rendered
 * directly above).
 */
function isReplyArticle(article: Element): boolean {
  const hasReplyingToText = Array.from(
    article.querySelectorAll("div, span")
  ).some((el) => el.textContent?.trim().startsWith("Replying to"))
  if (hasReplyingToText) return true

  const cell = article.closest('[data-testid="cellInnerDiv"]')
  const prevArticle = cell?.previousElementSibling?.querySelector(
    'article[data-testid="tweet"]'
  )
  return prevArticle ? hasOutgoingThreadConnector(prevArticle) : false
}

/**
 * Attempt to collect a post from a tweet article DOM element.
 * Returns null if the post shouldn't be collected (not own, too new, no impressions).
 */
export function collectFromArticle(
  article: Element,
  userHandle: string
): CollectedPost | null {
  // Must be own post
  if (!isOwnPost(article, userHandle)) return null

  // Must have a tweet ID
  const tweetId = extractTweetId(article)
  if (!tweetId) return null

  // Must have a timestamp and be 24+ hours old
  const postedAt = extractPostedAt(article)
  if (!postedAt) return null
  if (Date.now() - postedAt < MIN_AGE_MS) return null

  // Extract text
  const textEl = article.querySelector('[data-testid="tweetText"]')
  const text = textEl?.textContent?.trim() ?? ""
  if (!text) return null

  // Extract metrics
  const likes = parseAriaMetric(
    article.querySelector('[data-testid="like"]')
  )
  const retweets = parseAriaMetric(
    article.querySelector('[data-testid="retweet"]')
  )
  const replies = parseAriaMetric(
    article.querySelector('[data-testid="reply"]')
  )

  // Impressions: look for analytics link or views indicator
  let impressions = 0
  const analyticsLink = article.querySelector('a[href*="/analytics"]')
  if (analyticsLink) {
    impressions = parseCompactNumber(
      analyticsLink.textContent?.trim() ?? ""
    )
  }
  // Fallback: aria-label on the views element
  if (impressions === 0) {
    const viewsEl = article.querySelector('[role="group"] a[href*="/analytics"]')
    if (viewsEl) {
      const label = viewsEl.getAttribute("aria-label") || ""
      const match = label.match(/([\d.,]+[KkMmBb]?)\s*view/i)
      if (match) impressions = parseCompactNumber(match[1])
    }
  }

  // Must have impressions > 0
  if (impressions <= 0) return null

  // Quotes — may not always be visible
  const quotes = 0 // X doesn't consistently expose quote count in DOM

  // Engagement rate
  const totalEngagement = likes + retweets + replies + quotes
  const engagementRate = impressions > 0 ? totalEngagement / impressions : 0

  // Media detection
  const hasImage = article.querySelector('[data-testid="tweetPhoto"]') !== null
  const hasVideo = article.querySelector("video") !== null
  const hasLink = article.querySelector('[data-testid="card.wrapper"]') !== null
  const isReply = isReplyArticle(article)

  // Hook analysis
  let hookType: HookTypeName | null = null
  let hookScore = 0
  try {
    const config = getHookAnalyzerConfig()
    const result = analyzer.score(text, config)
    hookType = result.hookType
    hookScore = result.totalScore
  } catch {
    // Scoring may fail if config not loaded yet
  }

  // Topics
  const topics = extractTopics(text)

  return {
    tweetId,
    text,
    impressions,
    likes,
    retweets,
    replies,
    quotes,
    engagementRate,
    postedAt,
    collectedAt: Date.now(),
    charCount: text.length,
    hasImage,
    hasVideo,
    hasLink,
    isReply,
    hookType,
    hookScore,
    topics
  }
}
