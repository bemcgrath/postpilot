/** All hook type names supported by the scoring engine. */
export type HookTypeName =
  | "data_reveal"
  | "contrarian"
  | "curiosity_gap"
  | "stakes_urgency"
  | "personal_failure"
  | "question"
  | "pattern_recognition"
  | "shocking_stat"
  | "prediction"
  | "before_after"
  | "secret_reveal"
  | "social_proof"
  | "declarative_claim"
  | "observation"
  | "direct_challenge"
  | "stolen_thought"
  | "absurd_reframe"
  | "binary_frame"
  | "reader_mirror"
  | "amplification"

/** Definition of a hook type with patterns and scoring. */
export interface HookTypeDefinition {
  name: HookTypeName
  description: string
  patterns: string[] // regex pattern strings, matched with 'i' flag
  baseWeight: number // base performance weight (1.0 = average)
  examples: string[]
}

/** Breakdown of individual scoring components. */
export interface ScoreBreakdown {
  base: number
  hookType: number
  specificity: number
  length: number
  curiosityGap: number
  patternMatch: number
  penalties: number
  penaltyReasons: string[]
}

/** Result of hook analysis. */
export interface HookScore {
  totalScore: number // 0-100 overall score
  hookType: HookTypeName | null
  hookTypeConfidence: number // 0-1
  hookText: string
  breakdown: ScoreBreakdown
  suggestions: string[]
  isWeak: boolean // true if score < 60
}

/** Severity level for governor issues. */
export type IssueSeverity = "error" | "warning"

/** A single governor issue (banned phrase, weak phrase, overlength, etc). */
export interface GovernorIssue {
  severity: IssueSeverity
  message: string
  matchedText?: string
}

/** Result of governor checks. */
export interface GovernorResult {
  issues: GovernorIssue[]
  hasBannedPhrases: boolean
  hasWeakPhrases: boolean
  hasLengthWarning: boolean
  hasEmoji: boolean
}

/** Combined result from the full scoring pipeline. */
export interface PostScore {
  hookScore: HookScore
  governor: GovernorResult
  charCount: number
  inSweetSpot: boolean // 280-320 chars
  voiceMatch: import("./voice-types").VoiceMatchResult | null
}
