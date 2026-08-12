export interface VoiceDigest {
  distinctiveTerms: string[]
  sentenceLengthTarget: number
  firstPersonRatio: number
  secondPersonRatio: number
  topHookTypes: string[]
  signatureWords?: string[]
}

export type Identity =
  | { type: "license"; licenseKey: string; instanceId: string }
  | { type: "device"; deviceId: string }

export interface RewriteRequestBody {
  identity: Identity
  originalText: string
  isReply: boolean
  hookInfo: string
  governorLines: string
  suggestionLines: string
  band?: { min: number; max: number }
  count: 1 | 3
  voiceDigest?: VoiceDigest
}

export interface RewriteSuggestion {
  text: string
  hookType?: string
  rationale: string
}

export interface RewriteSuccessResponse {
  rewrites: RewriteSuggestion[]
}

export interface QuotaExceededResponse {
  error: "QUOTA_EXCEEDED"
  resetsAt: string // ISO timestamp, next UTC midnight
}

export interface GenericErrorResponse {
  error: string
}

export type Tier = "free" | "pro"

export interface Env {
  RATE_LIMIT_KV: KVNamespace
  ANTHROPIC_API_KEY: string
  MODEL_ID: string
  FREE_DAILY_CAP: string
  PRO_DAILY_CAP: string
}
