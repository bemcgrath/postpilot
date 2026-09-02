import type { HookTypeName } from "../scoring/types"

/** A post scraped from X.com with engagement metrics. */
export interface CollectedPost {
  tweetId: string
  text: string
  impressions: number
  likes: number
  retweets: number
  replies: number
  quotes: number
  engagementRate: number // (likes+RTs+replies+quotes) / impressions
  postedAt: number // epoch ms from <time datetime="">
  collectedAt: number // epoch ms when scraped
  charCount: number
  hasImage: boolean
  hasVideo: boolean
  hasLink: boolean
  isReply: boolean // was a reply to someone else's post, not a standalone post
  hookType: HookTypeName | null // classified via HookAnalyzer
  hookScore: number // 0-100
  topics: string[] // extracted keywords
}

/** Performance stats for a single hook type. */
export interface HookTypePerformance {
  hookType: HookTypeName
  postCount: number
  avgER: number
  boostMultiplier: number // avgER / baselineER, clamped 0.5-2.0
  topExamples: Array<{ tweetId: string; text: string; er: number }>
}

/** Performance stats for a length bucket. */
export interface LengthPerformance {
  bucket: string // e.g. "280-320"
  min: number
  max: number
  postCount: number
  avgER: number
  boostMultiplier: number
}

/** Performance stats for a topic keyword. */
export interface TopicPerformance {
  keyword: string
  postCount: number
  avgER: number
  boostMultiplier: number
}

/** Performance stats for a posting hour. */
export interface TimePerformance {
  hour: number // 0-23
  postCount: number
  avgER: number
  boostMultiplier: number
}

/** With/without media engagement comparison. */
export interface MediaPerformance {
  withImage: { postCount: number; avgER: number }
  withoutImage: { postCount: number; avgER: number }
  imageBoost: number // ratio
  withVideo: { postCount: number; avgER: number }
  withoutVideo: { postCount: number; avgER: number }
  videoBoost: number // ratio
  withLink: { postCount: number; avgER: number }
  withoutLink: { postCount: number; avgER: number }
  linkBoost: number // ratio
}

/** A human-readable tip generated from learned data. */
export interface Recommendation {
  type: "hook_type" | "length" | "time" | "media" | "topic"
  text: string
  boostMultiplier: number
}

/** Reply-specific craft signals, computed with the same predicates scoreReplyCraft uses. */
export interface ReplyCraftInsights {
  repliesAnalyzed: number
  baselineEngagementRate: number
  optimalLengthRange: { min: number; max: number }
  lengthPerformance: LengthPerformance[] // reply-specific buckets, not the originals' 0-100 first bucket
  hookTypeBoosts: Partial<Record<HookTypeName, number>>
  craftSignals: {
    multiSentenceShare: number // share of top replies with 2+ sentences
    mechanismShare: number // share of top replies with mechanism/constraint language
    specificityShare: number // share of top replies with a number or named entity
    praiseOnlyShareLow: number // share of bottom replies that are praise-only
  }
  topExamples: Array<{ tweetId: string; text: string; er: number }>
  lowExamples: Array<{ tweetId: string; text: string; er: number }>
  recommendation: string
}

/** How the originals side of an insights payload was computed. */
export type InsightsSegmentation = "segmented" | "blended"

/**
 * Partial insights shown to free users between PREVIEW_POSTS_FOR_LEARNING and
 * MIN_POSTS_FOR_LEARNING (the "Breakdown Preview" teaser). Only sub-analyzers
 * that already have enough data populate their field -- an empty array or
 * null means that section stays locked, not that it errored.
 */
export interface PreviewInsights {
  postsAnalyzed: number
  segmentation: InsightsSegmentation
  hookTypePerformance: HookTypePerformance[] // originals when segmented, else blended
  optimalLengthRange: { min: number; max: number } | null
  topicPerformance: TopicPerformance[]
  replyInsights: ReplyCraftInsights | null // null below MIN_REPLIES_FOR_LEARNING
}

/** Output of the learning engine — all personalized insights. */
export interface LearnedInsights {
  insightsVersion: number // 1 = pre-split (absent in stored data), 2 = segmented
  segmentation: InsightsSegmentation // describes only the originals side
  originalsAnalyzed: number
  repliesAnalyzed: number
  unknownSegmentCount: number
  replyInsights: ReplyCraftInsights | null

  generatedAt: number
  postsAnalyzed: number // still ALL posts, including unknown
  baselineEngagementRate: number // still median of ALL posts (displayed value)
  isReady: boolean // true when postsAnalyzed >= 20

  hookTypePerformance: HookTypePerformance[] // originals when segmented, else blended
  lengthPerformance: LengthPerformance[]
  topicPerformance: TopicPerformance[]
  timePerformance: TimePerformance[] // all days blended -- low-data fallback
  weekdayTimePerformance: TimePerformance[] // Mon-Fri only
  weekendTimePerformance: TimePerformance[] // Sat-Sun only
  mediaPerformance: MediaPerformance | null

  recommendations: Recommendation[]
  hookTypeBoosts: Partial<Record<HookTypeName, number>> // 0.5-2.0
  optimalLengthRange: { min: number; max: number } | null

  /** Populated only when !isReady && postsAnalyzed >= PREVIEW_POSTS_FOR_LEARNING. */
  previewInsights: PreviewInsights | null
}

/** Storage keys used by the learning engine. */
export const STORAGE_KEYS = {
  USER_HANDLE: "postpilot_user_handle",
  COLLECTED_POSTS: "postpilot_collected_posts",
  LEARNED_INSIGHTS: "postpilot_learned_insights",
  COLLECTION_FUNNEL: "postpilot_collection_funnel"
} as const

/** Minimum posts required before learning engine produces insights. */
export const MIN_POSTS_FOR_LEARNING = 20

/** Minimum posts before the "Breakdown Preview" teaser starts showing partial insights to free users. */
export const PREVIEW_POSTS_FOR_LEARNING = 5

/** Minimum originals required before the originals-side analyzers run segmented rather than blended. */
export const MIN_ORIGINALS_FOR_LEARNING = 12

/** Minimum replies required before replyInsights is computed (matches Atlas's validated threshold). */
export const MIN_REPLIES_FOR_LEARNING = 8

/** Maximum posts stored (oldest evicted). */
export const MAX_STORED_POSTS = 500
