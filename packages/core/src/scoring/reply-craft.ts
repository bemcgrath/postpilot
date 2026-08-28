/** Result of reply-craft scoring. */
export interface ReplyCraftScore {
  score: number // clamped to -15..15, added to HookScore.totalScore
  signals: string[]
  antiSignals: string[]
  suggestions: string[]
}

/**
 * Learned reply-length band, structurally compatible with (but decoupled
 * from) learning/types.ts's ReplyCraftInsights -- scoring must not import
 * from learning, matching the existing dependency direction in this codebase.
 */
export interface ReplyCraftBenchmarks {
  optimalLengthRange: { min: number; max: number }
}

const REPLY_SCORE_CAP = 15

/** Reply's own mechanism/constraint vocabulary (ported from Atlas, validated against 132 real replies). */
export const MECHANISM_LEXICON = [
  "because",
  "same pattern",
  "failure mode",
  "boundary",
  "constraint",
  "bottleneck",
  "tradeoff",
  "trade-off",
  "mechanism",
  "instead",
  "what if",
  "moved from",
  "rewrote",
  "ships",
  "deploy",
  "harness",
  "eval",
  "cost",
  "queue",
  "lock-in",
  "vendor"
]

const PRAISE_LEXICON = [
  "great point",
  "love this",
  "nice",
  "well said",
  "brilliant",
  "amazing",
  "so good",
  "this is the way",
  "excellent",
  "fantastic",
  "awesome",
  "beautiful",
  "spot on"
]

const AGREEMENT_ONLY_PATTERN = /^(agreed|exactly|this|\+1|so true|100%|facts)\b/i

const EMOJI_PATTERN =
  /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}]+/gu

const STOPWORDS = new Set([
  "this",
  "that",
  "these",
  "those",
  "have",
  "with",
  "your",
  "from",
  "just",
  "would",
  "could",
  "should",
  "about",
  "there",
  "their",
  "which",
  "when",
  "what",
  "where",
  "were",
  "been",
  "being",
  "into",
  "than",
  "then",
  "them",
  "they",
  "some",
  "very",
  "more",
  "most",
  "only",
  "such",
  "does",
  "doing"
])

/** Strip one or more leading @handle mentions -- handles are addressing, not craft. */
export function stripLeadingHandles(text: string): string {
  return text.replace(/^(?:@\w+\s+)+/, "")
}

function countSentences(text: string): number {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0).length
}

function hasMechanismLanguage(textLower: string): boolean {
  return MECHANISM_LEXICON.some((term) => textLower.includes(term))
}

function hasSpecificity(text: string): boolean {
  return /\d|\$|%/.test(text)
}

function tokenize(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .match(/[a-z0-9]+/g) ?? []
  return new Set(
    words.filter((w) => w.length >= 4 && !STOPWORDS.has(w))
  )
}

/** +3 if the reply contributes content the parent didn't have; 0 (no signal) if parentText is unavailable. */
function addsNotEchoes(text: string, parentText?: string | null): boolean | null {
  if (parentText == null) return null

  const replyTokens = tokenize(text)
  const parentTokens = tokenize(parentText)
  const novelTokens = [...replyTokens].filter((t) => !parentTokens.has(t))
  if (novelTokens.length >= 2) return true

  const replyNumbers = text.match(/\d+/g) ?? []
  const parentNumbers = new Set(parentText.match(/\d+/g) ?? [])
  if (replyNumbers.some((n) => !parentNumbers.has(n))) return true

  return false
}

function isPraiseOnly(textLower: string, stripped: string): boolean {
  const matchesPraise = PRAISE_LEXICON.some((p) => textLower.includes(p))
  return (
    matchesPraise &&
    !/\d/.test(stripped) &&
    !hasMechanismLanguage(textLower) &&
    stripped.length < 60
  )
}

function isAgreementOnly(stripped: string): boolean {
  return AGREEMENT_ONLY_PATTERN.test(stripped.trim()) && stripped.length < 40
}

function isNearEmpty(stripped: string): boolean {
  const withoutEmoji = stripped.replace(EMOJI_PATTERN, "").trim()
  return withoutEmoji.length < 25
}

/**
 * Score a reply's craft: does it add substance, or is it praise/agreement/emoji noise?
 * Positive signals can raw-sum above +15 and anti-signals can raw-sum below -15
 * (e.g. "so true" triggers both agreement-only and near-empty, -18 raw) -- the
 * final score is clamped to +/-15 to match HookTypeBonusMax's ceiling, the
 * sibling "sub-score" this is designed to sit alongside.
 */
export function scoreReplyCraft(
  text: string,
  opts?: { parentText?: string | null; benchmarks?: ReplyCraftBenchmarks | null }
): ReplyCraftScore {
  const stripped = stripLeadingHandles(text).trim()
  const strippedLower = stripped.toLowerCase()

  const signals: string[] = []
  const antiSignals: string[] = []
  const suggestions: string[] = []
  let raw = 0

  if (countSentences(stripped) >= 2) {
    raw += 4
    signals.push("multi-sentence")
  }

  if (hasMechanismLanguage(strippedLower)) {
    raw += 5
    signals.push("mechanism")
  } else {
    suggestions.push("Name the mechanism, not just the reaction")
  }

  if (hasSpecificity(stripped)) {
    raw += 3
    signals.push("specificity")
  }

  const adds = addsNotEchoes(stripped, opts?.parentText)
  if (adds === true) {
    raw += 3
    signals.push("adds-not-echoes")
  }

  const band = opts?.benchmarks?.optimalLengthRange
  if (band && stripped.length >= band.min && stripped.length <= band.max) {
    raw += 2
    signals.push("in-band")
  }

  const praiseOnly = isPraiseOnly(strippedLower, stripped)
  if (praiseOnly) {
    raw -= 8
    antiSignals.push("praise-only")
    suggestions.push("Add a number or a mechanism, not just praise")
  }

  const agreementOnly = isAgreementOnly(stripped)
  if (agreementOnly) {
    raw -= 8
    antiSignals.push("agreement-only")
  }

  if (isNearEmpty(stripped)) {
    raw -= 10
    antiSignals.push("near-empty")
  }

  const score = Math.max(-REPLY_SCORE_CAP, Math.min(REPLY_SCORE_CAP, raw))

  return { score, signals, antiSignals, suggestions: suggestions.slice(0, 3) }
}
