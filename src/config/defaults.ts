import type {
  GovernorConfig,
  HookAnalyzerConfig,
  HookTypesConfig,
  PhraseEntry,
  PipelineConfig,
  PostPilotConfig
} from "./types"

/** Generate a stable ID from a pattern string. */
function patternId(prefix: string, pattern: string): string {
  // Simple hash: prefix + first 40 chars of pattern, replacing non-alphanum
  const clean = pattern.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40)
  return `${prefix}_${clean}`
}

/** Convert regex pattern strings to PhraseEntry array. */
function phrasesFromPatterns(
  prefix: string,
  patterns: string[],
  labels?: string[]
): PhraseEntry[] {
  return patterns.map((p, i) => ({
    id: patternId(prefix, p),
    pattern: p,
    label: labels?.[i],
    enabled: true,
    isCustom: false
  }))
}

// ---- Banned phrases (29) ----
const BANNED_PHRASE_PATTERNS = [
  "\\bthoughts\\?",
  "\\byou should\\b",
  "\\bgame[- ]changer\\b",
  "\\brevolutionary\\b",
  "\\blet me know\\b",
  "\\bwhat do you think\\b",
  "\\bdrop a comment\\b",
  "\\bfollow for more\\b",
  "\\bretweet\\b",
  "\\brt if\\b",
  "\\bunlock(?:s|ing|ed)?\\b",
  "\\bleverag(?:e|es|ing|ed)\\b",
  "\\bdelv(?:e|ing|es|ed)\\b",
  "signals? a (?:bigger|major|larger|significant) shift",
  "what this signals",
  "\\bthis signals\\b",
  "\\w—\\w",
  "—it's\\b",
  "—and\\b",
  "—but\\b",
  "—that's\\b",
  "\\b\\d+%\\s*confident\\b",
  "\\bconfident this\\b",
  "\\b18 months\\b",
  "\\b12 months\\b",
  "\\bthis accelerates\\b",
  "\\bi've tested\\b",
  "\\btools like\\b",
  "\\bthis year\\b"
]

const BANNED_PHRASE_LABELS = [
  "thoughts?",
  "you should",
  "game-changer",
  "revolutionary",
  "let me know",
  "what do you think",
  "drop a comment",
  "follow for more",
  "retweet",
  "rt if",
  "unlock/unlocks/unlocking",
  "leverage/leverages/leveraging",
  "delve/delving",
  "signals a bigger/major shift",
  "what this signals",
  "this signals",
  "em-dash (word—word)",
  "em-dash (—it's)",
  "em-dash (—and)",
  "em-dash (—but)",
  "em-dash (—that's)",
  "X% confident",
  "confident this",
  "18 months",
  "12 months",
  "this accelerates",
  "I've tested",
  "tools like",
  "this year"
]

// ---- Weak phrases (37) ----
const WEAK_PHRASE_PATTERNS = [
  "this could have implications",
  "this marks a significant",
  "this illustrates a growing trend",
  "this raises questions about",
  "developers should pay attention",
  "the technology is advancing",
  "this represents an opportunity",
  "we should consider",
  "it's important to note",
  "this is significant as",
  "this could streamline",
  "this demonstrates the",
  "this highlights the",
  "this showcases",
  "warrants further exploration",
  "has the potential to",
  "could be significant",
  "may impact",
  "here's what matters",
  "the trend is clear",
  "the pattern is clear",
  "is becoming indispensable",
  "is poised to",
  "is aimed at",
  "continues the pattern",
  "indicates a shift toward",
  "expect improved",
  "to stay ahead",
  "the bottom line:",
  "the key takeaway:",
  "the mistake is",
  "let's discuss",
  "what other",
  "share your thoughts",
  "the pattern:",
  "what breaks (?:this|it):",
  "reversal signal:"
]

// ---- Fabrication patterns (5) ----
const FABRICATION_PATTERNS = [
  "I(?:'ve)? tracked .{1,40} for \\d+ (?:days|weeks|months)",
  "I(?:'ve)? tested \\d+ ",
  "I ran .{1,30} experiments?",
  "My data show(?:s|ed)",
  "Here'?s what I found"
]

const FABRICATION_LABELS = [
  "Personal tracking claim",
  "Personal testing claim with count",
  "Personal experiment claim",
  "Personal data claim",
  "Personal findings claim"
]

// ---- Fabricated stats (2) ----
const FABRICATED_STATS_PATTERNS = [
  "\\d+% (?:reduction|increase|improvement|decrease|drop|rise|growth)",
  "(?:After|Over) \\d+ (?:days|weeks|months|years).{1,50}\\d+%"
]

const FABRICATED_STATS_LABELS = [
  "Specific percentage change",
  "Time-based percentage claim"
]

function buildGovernorDefaults(): GovernorConfig {
  return {
    bannedPhrases: phrasesFromPatterns("banned", BANNED_PHRASE_PATTERNS, BANNED_PHRASE_LABELS),
    weakPhrases: phrasesFromPatterns("weak", WEAK_PHRASE_PATTERNS),
    fabricationPatterns: phrasesFromPatterns("fab", FABRICATION_PATTERNS, FABRICATION_LABELS),
    fabricatedStatsPatterns: phrasesFromPatterns("fabstat", FABRICATED_STATS_PATTERNS, FABRICATED_STATS_LABELS),
    lengthErrorThreshold: 500,
    lengthWarningThreshold: 350,
    emojiWarningEnabled: true
  }
}

function buildHookAnalyzerDefaults(): HookAnalyzerConfig {
  return {
    baseScore: 50,
    hookTypeBonusMax: 15,
    specificity: {
      numbers: 8,
      timeframe: 6,
      entity: 6
    },
    length: {
      optimalMin: 40,
      optimalMax: 100,
      acceptableMin: 30,
      acceptableMax: 120,
      optimalScore: 10,
      acceptableScore: 5
    },
    curiosityGap: {
      openLoopBonus: 10,
      tensionWordBonus: 5
    },
    penalties: {
      genericOpener: -10,
      blandStart: -15,
      tooLongHook: -5,
      questionNoNumbers: -5
    },
    hookMaxLength: 120,
    weakThreshold: 60
  }
}

function buildHookTypesDefaults(): HookTypesConfig {
  return {
    overrides: {}
  }
}

function buildPipelineDefaults(): PipelineConfig {
  return {
    sweetSpotMin: 280,
    sweetSpotMax: 320
  }
}

/** Build a complete default config with all current hardcoded values. */
export function buildDefaults(): PostPilotConfig {
  return {
    schemaVersion: 1,
    governor: buildGovernorDefaults(),
    hookAnalyzer: buildHookAnalyzerDefaults(),
    hookTypes: buildHookTypesDefaults(),
    pipeline: buildPipelineDefaults()
  }
}

export {
  BANNED_PHRASE_PATTERNS,
  BANNED_PHRASE_LABELS,
  WEAK_PHRASE_PATTERNS,
  FABRICATION_PATTERNS,
  FABRICATION_LABELS,
  FABRICATED_STATS_PATTERNS,
  FABRICATED_STATS_LABELS
}
