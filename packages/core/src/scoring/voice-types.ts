import type { HookTypeName } from "./types"

export interface SamplePost {
  id: string
  text: string
  addedAt: number
  sourceTweetId?: string // set when imported from a collected post -- enables de-dup against re-import
}

export interface NumericProfile {
  mean: number
  stdDev: number
  min: number
  max: number
}

export interface VocabEntry {
  term: string
  count: number // posts containing this term
  frequency: number // count / totalPosts
}

export interface VoiceFingerprint {
  generatedAt: number
  sampleCount: number
  distinctiveTerms: VocabEntry[] // top 30 non-stopword terms
  sentenceLength: NumericProfile // words per sentence
  fragmentRatio: number // % sentences <= 5 words
  hookTypeDistribution: Partial<Record<HookTypeName, number>>
  topHookTypes: HookTypeName[] // top 3
  postLength: NumericProfile // chars per post
  questionRatio: number
  exclamationRatio: number
  firstPersonRatio: number // "I" / "my" usage
  secondPersonRatio: number // "you" / "your" usage
  formalityScore: number // 0-1
  nicheKeywords: VocabEntry[] // top 20 topic words
  lineBreakFrequency: NumericProfile
  avgParagraphs: number
  usesColons: number // ratio
  usesLists: number // ratio
}

export type DiagnosticSeverity = "info" | "warning"

export interface DiagnosticTip {
  severity: DiagnosticSeverity
  category: string
  message: string
}

export interface VoiceOverrides {
  addSignatureWords: string[]
  removeSignatureWords: string[]
  addNicheKeywords: string[]
  removeNicheKeywords: string[]
  lengthMin: number | null
  lengthMax: number | null
  preferredHookTypes: HookTypeName[]
  firstPersonRatio: number | null
  secondPersonRatio: number | null
  questionRatio: number | null
  exclamationRatio: number | null
}

export interface VoiceMatchDimension {
  name: string
  score: number // 0-100
  weight: number // sums to 1.0
  feedback: string | null
}

export interface VoiceMatchResult {
  totalScore: number // 0-100
  dimensions: VoiceMatchDimension[]
}
