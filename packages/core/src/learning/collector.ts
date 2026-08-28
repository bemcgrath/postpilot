import type { CollectedPost } from "./types"
import type { HookTypeName } from "../scoring/types"

import { extractTopics } from "./topic-extractor"
import { HookAnalyzer } from "../scoring/hook-analyzer"
import { getHookAnalyzerConfig } from "../config/config-storage"

/**
 * Split from the extension's src/dom/collector.ts (2026-08-28 monorepo
 * extraction): this half has no DOM dependency, only a (portable) in-memory
 * config-cache read. The DOM-scraping half (inspectOwnArticle and
 * everything it depends on) stays extension-side -- there's no x.com DOM to
 * scrape on mobile, which is why the learning engine's Pro cold-start
 * problem exists there (see the mobile plan's "Pro cold-start" section).
 */

const analyzer = new HookAnalyzer()

/** Minimum age in ms before collecting a post (24 hours). */
export const OWN_POST_MIN_AGE_MS = 24 * 60 * 60 * 1000

export type OwnArticleInspect =
  | { kind: "not_own" }
  | {
      kind: "skip"
      reason: "no_id" | "no_timestamp" | "too_new" | "no_text" | "no_impressions"
      tweetId: string | null
    }
  | { kind: "collect"; post: CollectedPost }

/** Hook type, score, and topics for a collected post. Shared with CSV import. */
export function classifyCollectedText(text: string): {
  hookType: HookTypeName | null
  hookScore: number
  topics: string[]
} {
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
  return { hookType, hookScore, topics: extractTopics(text) }
}

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
