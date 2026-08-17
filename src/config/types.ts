import type { HookTypeName } from "~scoring/types"

/** A single phrase rule (banned, weak, fabrication, etc). */
export interface PhraseEntry {
  id: string
  pattern: string // regex pattern string
  label?: string // human-readable description
  enabled: boolean
  isCustom: boolean // true for user-added entries
}

/** Governor configuration. */
export interface GovernorConfig {
  bannedPhrases: PhraseEntry[]
  weakPhrases: PhraseEntry[]
  aiSlopPhrases: PhraseEntry[]
  fabricationPatterns: PhraseEntry[]
  fabricatedStatsPatterns: PhraseEntry[]
  lengthErrorThreshold: number // hard error above this (default 500)
  lengthWarningThreshold: number // soft warning above this (default 350)
  emojiWarningEnabled: boolean
  allCapsWarningEnabled: boolean
  allCapsAllowlist: string[] // acronyms exempt from the all-caps check
  spammyPunctuationWarningEnabled: boolean
  hashtagWarningEnabled: boolean
  hashtagLimit: number // flag when hashtag count exceeds this (default 2)
}

/** Hook analyzer scoring thresholds. */
export interface HookAnalyzerConfig {
  baseScore: number
  hookTypeBonusMax: number
  specificity: {
    numbers: number
    timeframe: number
    entity: number
  }
  length: {
    optimalMin: number
    optimalMax: number
    acceptableMin: number
    acceptableMax: number
    optimalScore: number
    acceptableScore: number
  }
  curiosityGap: {
    openLoopBonus: number
    tensionWordBonus: number
  }
  penalties: {
    genericOpener: number // negative value
    blandStart: number // negative value
    tooLongHook: number // negative value
    questionNoNumbers: number // negative value
  }
  hookMaxLength: number // max hook extraction length (default 120)
  weakThreshold: number // score below this = weak (default 60)
}

/** Per-hook-type user overrides. */
export interface HookTypeOverride {
  enabled: boolean
  baseWeight: number
  customPatterns: string[] // additional user-added regex patterns
}

/** Hook types configuration. */
export interface HookTypesConfig {
  overrides: Partial<Record<HookTypeName, HookTypeOverride>>
}

/** Pipeline configuration (sweet spot, etc). */
export interface PipelineConfig {
  sweetSpotMin: number
  sweetSpotMax: number
  replySweetSpotMin: number // cold-start default; learned optimalLengthRange takes precedence once available
  replySweetSpotMax: number
}

/** Top-level config object. */
export interface PostPilotConfig {
  schemaVersion: number
  governor: GovernorConfig
  hookAnalyzer: HookAnalyzerConfig
  hookTypes: HookTypesConfig
  pipeline: PipelineConfig
}
