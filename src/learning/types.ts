import type { HookTypeName } from "~scoring/types"

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

/** Output of the learning engine — all personalized insights. */
export interface LearnedInsights {
  generatedAt: number
  postsAnalyzed: number
  baselineEngagementRate: number
  isReady: boolean // true when postsAnalyzed >= 20

  hookTypePerformance: HookTypePerformance[]
  lengthPerformance: LengthPerformance[]
  topicPerformance: TopicPerformance[]
  timePerformance: TimePerformance[] // all days blended -- low-data fallback
  weekdayTimePerformance: TimePerformance[] // Mon-Fri only
  weekendTimePerformance: TimePerformance[] // Sat-Sun only
  mediaPerformance: MediaPerformance | null

  recommendations: Recommendation[]
  hookTypeBoosts: Partial<Record<HookTypeName, number>> // 0.5-2.0
  optimalLengthRange: { min: number; max: number } | null
}

/** Storage keys used by the learning engine. */
export const STORAGE_KEYS = {
  USER_HANDLE: "postpilot_user_handle",
  COLLECTED_POSTS: "postpilot_collected_posts",
  LEARNED_INSIGHTS: "postpilot_learned_insights"
} as const

/** Minimum posts required before learning engine produces insights. */
export const MIN_POSTS_FOR_LEARNING = 20

/** Maximum posts stored (oldest evicted). */
export const MAX_STORED_POSTS = 500
