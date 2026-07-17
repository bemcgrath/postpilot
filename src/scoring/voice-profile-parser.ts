import type { HookTypeName } from "./types"
import type { NumericProfile, VocabEntry, VoiceFingerprint } from "./voice-types"

/**
 * Data extracted from a voice profile markdown document.
 * Used to seed/override statistical fingerprint fields.
 */
export interface ProfileData {
  nicheKeywords: VocabEntry[]
  topHookTypes: HookTypeName[]
  hookTypeDistribution: Partial<Record<HookTypeName, number>>
  preferredLength: NumericProfile | null
  firstPersonRatio: number | null
  secondPersonRatio: number | null
  usesColons: number | null
  fragmentRatio: number | null
  formalityScore: number | null
  distinctiveTerms: VocabEntry[]
}

/** Map from voice profile hook names to our HookTypeName values. */
const HOOK_NAME_MAP: Record<string, HookTypeName> = {
  "personal transformation": "before_after",
  "quote amplification": "social_proof",
  "specific number lead": "shocking_stat",
  "data reveal": "data_reveal",
  "contrarian": "contrarian",
  "direct challenge": "direct_challenge",
  "model update": "contrarian",
  "stolen thought": "stolen_thought",
  "stakes urgency": "stakes_urgency",
  "absurd reframe": "absurd_reframe",
  "personal failure": "personal_failure",
  "pattern recognition": "pattern_recognition",
  "curiosity gap": "curiosity_gap",
  "binary frame": "binary_frame",
  "reader mirror": "reader_mirror",
  "question": "question",
  "prediction": "prediction",
  "secret reveal": "secret_reveal",
  "observation": "observation",
  "declarative claim": "declarative_claim",
  "before after": "before_after",
  "social proof": "social_proof",
  "shocking stat": "shocking_stat"
}

/**
 * Parse a voice profile markdown (and optional niche spec) to extract
 * structured data that can seed a VoiceFingerprint.
 */
export function parseVoiceProfile(
  profileMarkdown: string,
  nicheSpecMarkdown?: string
): ProfileData {
  const combined = profileMarkdown + "\n" + (nicheSpecMarkdown ?? "")

  return {
    nicheKeywords: extractNicheKeywords(combined),
    topHookTypes: extractHookRanking(profileMarkdown),
    hookTypeDistribution: buildHookDistribution(profileMarkdown),
    preferredLength: extractPreferredLength(profileMarkdown),
    firstPersonRatio: extractToneSignal(profileMarkdown, "first"),
    secondPersonRatio: extractToneSignal(profileMarkdown, "second"),
    usesColons: extractColonUsage(profileMarkdown),
    fragmentRatio: extractFragmentUsage(profileMarkdown),
    formalityScore: extractFormality(profileMarkdown),
    distinctiveTerms: extractDistinctiveTerms(profileMarkdown)
  }
}

/** Strip markdown emphasis/code markers that leak into extracted terms. */
function cleanTerm(raw: string): string {
  return raw.replace(/[*_`]/g, "").trim().toLowerCase()
}

/** Extract niche keywords from "Trending keywords:" lines and keyword tables. */
function extractNicheKeywords(text: string): VocabEntry[] {
  const keywords = new Set<string>()

  // Match "Trending keywords:" or "Keywords" patterns
  const trendingMatches = text.matchAll(
    /(?:trending keywords|keywords)[:\s]*([^\n|]+)/gi
  )
  for (const match of trendingMatches) {
    const terms = match[1].split(/[,;]/).map(cleanTerm)
    for (const term of terms) {
      if (term.length > 1 && term.length < 30) keywords.add(term)
    }
  }

  // Match keyword table cells (| keyword1, keyword2 |)
  const tableMatches = text.matchAll(
    /\|\s*(?:\*\*)?(?:AI Agents|Longevity|Bitcoin|Crypto)[^|]*\|[^|]*\|[^|]*?([a-z][^|]+)\|/gi
  )
  for (const match of tableMatches) {
    const terms = match[1].split(/[,;]/).map(cleanTerm)
    for (const term of terms) {
      if (term.length > 1 && term.length < 30) keywords.add(term)
    }
  }

  // Also grab domain-specific terms from section headers and bold text
  const domainTerms = [
    "ai agents", "agentic", "agent workflow", "llm", "claude", "mcp",
    "inference", "longevity", "aging", "healthspan", "nad", "glucose",
    "biomarkers", "bitcoin", "mining", "asic", "hashrate", "settlement",
    "stablecoin", "autonomous", "tool use", "codex", "gpt", "openai",
    "anthropic", "metabolic", "systems thinking", "mental models"
  ]
  const textLower = text.toLowerCase()
  for (const term of domainTerms) {
    if (textLower.includes(term)) keywords.add(term)
  }

  return Array.from(keywords).map((term) => ({
    term,
    count: 1,
    frequency: 1.0
  }))
}

/** Extract hook type rankings from the "Ranked by performance" table. */
function extractHookRanking(text: string): HookTypeName[] {
  const ranked: Array<{ type: HookTypeName; rank: number }> = []

  // Legacy format: | **Hook Name** | ... | ... | **#N** |
  const legacyRows = text.matchAll(
    /\|\s*\*\*([^*]+)\*\*\s*\|[^|]*\|[^|]*\|\s*\*\*#(\d+)/g
  )
  for (const match of legacyRows) {
    const name = match[1].trim().toLowerCase()
    const rank = parseInt(match[2], 10)
    const hookType = HOOK_NAME_MAP[name]
    if (hookType && !isNaN(rank)) {
      ranked.push({ type: hookType, rank })
    }
  }

  // Rank-first format: | 3 | **Hook Name** | ... |
  const rankFirstRows = text.matchAll(/\|\s*(\d+)\s*\|\s*\*\*([^*|]+)\*\*/g)
  for (const match of rankFirstRows) {
    const rank = parseInt(match[1], 10)
    const name = match[2].trim().toLowerCase()
    const hookType = HOOK_NAME_MAP[name]
    if (hookType && !isNaN(rank)) {
      ranked.push({ type: hookType, rank })
    }
  }

  // Sort by rank, deduplicate, take top 5
  ranked.sort((a, b) => a.rank - b.rank)
  const seen = new Set<HookTypeName>()
  const result: HookTypeName[] = []
  for (const { type } of ranked) {
    if (!seen.has(type) && result.length < 5) {
      seen.add(type)
      result.push(type)
    }
  }

  return result
}

/** Build a hook type distribution from the ranked table. */
function buildHookDistribution(text: string): Partial<Record<HookTypeName, number>> {
  const top = extractHookRanking(text)
  if (top.length === 0) return {}

  const dist: Partial<Record<HookTypeName, number>> = {}
  // Weight decreases by rank: #1 = 0.30, #2 = 0.25, #3 = 0.20, etc.
  const weights = [0.30, 0.25, 0.20, 0.15, 0.10]
  for (let i = 0; i < top.length; i++) {
    dist[top[i]] = weights[i] ?? 0.05
  }
  return dist
}

/** Extract preferred post length from "280-320" references. */
function extractPreferredLength(text: string): NumericProfile | null {
  // Look for "280-320 chars" pattern
  const match = text.match(/(\d{2,3})\s*[-–]\s*(\d{2,3})\s*char/)
  if (match) {
    const min = parseInt(match[1], 10)
    const max = parseInt(match[2], 10)
    const mean = (min + max) / 2
    return {
      mean,
      stdDev: (max - min) / 4, // approximate
      min,
      max
    }
  }
  return null
}

/** Extract first/second person usage signals from profile text. */
function extractToneSignal(
  text: string,
  person: "first" | "second"
): number | null {
  const textLower = text.toLowerCase()

  if (person === "first") {
    // Look for indicators of first-person writing
    if (
      textLower.includes("first person") ||
      textLower.includes('"i did') ||
      textLower.includes('"i tracked') ||
      textLower.includes("personal data") ||
      textLower.includes("personal experiment")
    ) {
      return 0.7 // strong first-person voice
    }
  }

  if (person === "second") {
    // Look for "reader-directed" or "you" patterns
    if (
      textLower.includes("reader-directed") ||
      textLower.includes('"if you\'re') ||
      textLower.includes("addresses the reader") ||
      textLower.includes("reader bridge")
    ) {
      return 0.5
    }
  }

  return null
}

/** Detect colon usage preference. */
function extractColonUsage(text: string): number | null {
  const textLower = text.toLowerCase()
  if (
    textLower.includes('framing ("here\'s what') ||
    textLower.includes("here's what") ||
    textLower.includes("here's why")
  ) {
    return 0.6
  }
  return null
}

/** Detect fragment/short sentence preference. */
function extractFragmentUsage(text: string): number | null {
  const textLower = text.toLowerCase()
  if (
    textLower.includes("one-line paragraphs") ||
    textLower.includes("short paragraphs") ||
    textLower.includes("punchy sentences") ||
    textLower.includes("single-line punches")
  ) {
    return 0.4 // notable fragment usage
  }
  return null
}

/** Detect formality level. */
function extractFormality(text: string): number | null {
  const textLower = text.toLowerCase()
  if (
    textLower.includes("conversational tone") ||
    textLower.includes("talk like you're telling a friend")
  ) {
    return 0.3 // conversational
  }
  if (textLower.includes("analytical") || textLower.includes("clinical")) {
    return 0.5 // moderate
  }
  return null
}

/** Extract distinctive vocabulary patterns from the profile. */
function extractDistinctiveTerms(text: string): VocabEntry[] {
  const terms = new Set<string>()

  // Extract quoted patterns: "if you're...", "converging on", etc.
  const quotedMatches = text.matchAll(/"([^"]{3,30})"/g)
  for (const match of quotedMatches) {
    const phrase = match[1].toLowerCase().replace(/[.…!?,;:]+$/, "").trim()
    if (phrase.length >= 3 && phrase.length <= 25 && !phrase.includes("|")) {
      terms.add(phrase)
    }
  }

  // Extract structural/mechanism terms that appear as bold or in preferred patterns
  const mechanismTerms = [
    "bottleneck", "flywheel", "compounding", "convergence",
    "moat", "signal", "mechanism", "systems", "deploy",
    "calibrated", "durable", "optionality", "implementation"
  ]
  const textLower = text.toLowerCase()
  for (const term of mechanismTerms) {
    if (textLower.includes(term)) terms.add(term)
  }

  return Array.from(terms).map((term) => ({
    term,
    count: 1,
    frequency: 1.0
  }))
}

/**
 * Merge profile-extracted data into a post-derived fingerprint.
 * Profile data takes priority for niche/hooks; post statistics fill in
 * dimensions that can't be extracted from markdown.
 */
export function mergeProfileIntoFingerprint(
  postFingerprint: VoiceFingerprint,
  profile: ProfileData
): VoiceFingerprint {
  const merged = { ...postFingerprint }

  // Niche keywords: profile keywords take priority, then post-derived
  if (profile.nicheKeywords.length > 0) {
    const profileTerms = new Set(profile.nicheKeywords.map((k) => k.term))
    const postOnly = postFingerprint.nicheKeywords.filter(
      (k) => !profileTerms.has(k.term)
    )
    merged.nicheKeywords = [
      ...profile.nicheKeywords,
      ...postOnly
    ].slice(0, 30)
  }

  // Hook types: profile rankings override
  if (profile.topHookTypes.length > 0) {
    merged.topHookTypes = profile.topHookTypes.slice(0, 3)
    merged.hookTypeDistribution = {
      ...postFingerprint.hookTypeDistribution,
      ...profile.hookTypeDistribution
    }
  }

  // Preferred length: use profile if available
  if (profile.preferredLength) {
    merged.postLength = profile.preferredLength
  }

  // Tone signals: use profile values, fall back to post statistics
  if (profile.firstPersonRatio !== null) {
    merged.firstPersonRatio = profile.firstPersonRatio
  }
  if (profile.secondPersonRatio !== null) {
    merged.secondPersonRatio = profile.secondPersonRatio
  }
  if (profile.formalityScore !== null) {
    merged.formalityScore = profile.formalityScore
  }

  // Structure: use profile if available
  if (profile.usesColons !== null) {
    merged.usesColons = profile.usesColons
  }
  if (profile.fragmentRatio !== null) {
    merged.fragmentRatio = profile.fragmentRatio
  }

  // Distinctive terms: merge (profile first, then post-derived)
  if (profile.distinctiveTerms.length > 0) {
    const profileTerms = new Set(profile.distinctiveTerms.map((t) => t.term))
    const postOnly = postFingerprint.distinctiveTerms.filter(
      (t) => !profileTerms.has(t.term)
    )
    merged.distinctiveTerms = [
      ...profile.distinctiveTerms,
      ...postOnly
    ].slice(0, 30)
  }

  return merged
}

/**
 * Build a fingerprint entirely from profile data (no sample posts).
 * Fills in reasonable defaults for statistical fields.
 */
export function fingerprintFromProfile(
  profile: ProfileData
): VoiceFingerprint {
  return {
    generatedAt: Date.now(),
    sampleCount: 0,
    distinctiveTerms: profile.distinctiveTerms,
    sentenceLength: { mean: 10, stdDev: 5, min: 3, max: 25 },
    fragmentRatio: profile.fragmentRatio ?? 0.3,
    hookTypeDistribution: profile.hookTypeDistribution,
    topHookTypes: profile.topHookTypes.slice(0, 3),
    postLength: profile.preferredLength ?? {
      mean: 300,
      stdDev: 40,
      min: 200,
      max: 400
    },
    questionRatio: 0.2,
    exclamationRatio: 0.1,
    firstPersonRatio: profile.firstPersonRatio ?? 0.5,
    secondPersonRatio: profile.secondPersonRatio ?? 0.3,
    formalityScore: profile.formalityScore ?? 0.4,
    nicheKeywords: profile.nicheKeywords,
    lineBreakFrequency: { mean: 3, stdDev: 2, min: 0, max: 8 },
    avgParagraphs: 3,
    usesColons: profile.usesColons ?? 0.5,
    usesLists: 0.2
  }
}
