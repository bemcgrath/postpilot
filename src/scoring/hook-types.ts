import type { HookTypeDefinition, HookTypeName } from "./types"
import type { HookTypesConfig } from "~config/types"

import { getHookTypesConfig } from "~config/config-storage"

/** All 20 hook types ported from Atlas hook_types.py */
export const HOOK_TYPES: Record<HookTypeName, HookTypeDefinition> = {
  data_reveal: {
    name: "data_reveal",
    description:
      "Lead with specific data from personal tracking or research",
    patterns: [
      "i tracked",
      "i measured",
      "i tested",
      "i analyzed",
      "data show",
      "the numbers",
      "research show",
      "stud(?:y|ies) (?:show|found|suggest)",
      "after \\d+ (?:days|weeks|months|years)",
      "for \\d+ (?:days|weeks|months|years)",
      "over \\d+ (?:days|weeks|months|years)",
      "detection in \\d+",
      "in \\d+ (?:samples|studies|subjects|patients|cases)"
    ],
    baseWeight: 1.3,
    examples: [
      "I tracked 50 AI agents for 90 days. Here's what the data showed:",
      "Research shows VO2 max predicts mortality better than cholesterol.",
      "Iodine-129 detection in 119 seawater samples signals a need for..."
    ]
  },

  contrarian: {
    name: "contrarian",
    description: "Challenge common belief or conventional wisdom",
    patterns: [
      "is wrong",
      "isn.t (?:true|real|working|just|the)",
      "not (?:just|the way|what)",
      "don.t need",
      "the (?:real|true) (?:reason|problem)",
      "myth",
      "stop (?:believing|thinking|saying)",
      "everyone.s wrong",
      "unpopular opinion",
      "overrated",
      "underrated",
      "i.m sorry but",
      "this is not the way",
      "misunderstand"
    ],
    baseWeight: 1.35,
    examples: [
      "Everything you've read about RAG is wrong.",
      "AI isn't just coming for white-collar jobs\u2014it's enabling radical shifts.",
      "I'm sorry but this is not the way."
    ]
  },

  curiosity_gap: {
    name: "curiosity_gap",
    description: "Create an open loop that demands resolution",
    patterns: [
      "here.s (?:what|why|how)",
      "this is (?:what|why|how)",
      "the (?:secret|trick|key)",
      "what (?:they|no one) (?:tells|told)",
      "you won.t believe",
      "i discovered",
      "turns out",
      "is why",
      "the (?:question|part) (?:is|nobody)"
    ],
    baseWeight: 1.15,
    examples: [
      "Here's why your AI agent keeps failing at simple tasks:",
      "Is this why Claude Code took a different approach?"
    ]
  },

  stakes_urgency: {
    name: "stakes_urgency",
    description: "Create urgency through stakes or time pressure",
    patterns: [
      "window (?:is|for)",
      "before (?:it.s|you)",
      "deadline",
      "accelerating",
      "last chance",
      "running out",
      "by 20\\d\\d",
      "in \\d+ (?:months|years)",
      "critical",
      "inevitable",
      "the direction is",
      "if you.re (?:building|in|over)"
    ],
    baseWeight: 1.2,
    examples: [
      "The window to build AI agents is closing.",
      "The timeline might be aggressive, but the direction is inevitable."
    ]
  },

  personal_failure: {
    name: "personal_failure",
    description:
      "Vulnerability through personal failure and lesson learned",
    patterns: [
      "i (?:lost|failed|screwed|blew|wasted)",
      "my (?:biggest|worst) mistake",
      "cost me",
      "i was wrong",
      "i learned the hard way",
      "embarrassing",
      "humbling"
    ],
    baseWeight: 1.3,
    examples: [
      "I lost $50K testing this. Here's what I learned:",
      "I was wrong about longevity supplements."
    ]
  },

  question: {
    name: "question",
    description: "Open with a direct, thought-provoking question",
    patterns: [
      "\\?$",
      "^(?:@\\w+\\s+)?why (?:do|does|did|is|are|would|can)",
      "^(?:@\\w+\\s+)?how (?:do|does|did|can|could|would|hard|is|much)",
      "^(?:@\\w+\\s+)?what if",
      "^(?:@\\w+\\s+)?what (?:makes|causes|happens)",
      "^(?:@\\w+\\s+)?is (?:this|that|it)",
      "^(?:@\\w+\\s+)?have you ever",
      "^(?:@\\w+\\s+)?did you know"
    ],
    baseWeight: 1.0,
    examples: [
      "Why do 90% of AI agents fail in production?",
      "How hard is it to manufacture and what's the cost?",
      "Is this why Claude Code took a different approach?"
    ]
  },

  pattern_recognition: {
    name: "pattern_recognition",
    description:
      "Share a pattern discovered across multiple observations",
    patterns: [
      "i noticed",
      "pattern",
      "across \\d+",
      "common (?:thread|theme|pattern)",
      "the (?:same|identical) (?:thing|pattern|mistake)",
      "every (?:time|single)",
      "recur",
      "signal(?:s|ing)"
    ],
    baseWeight: 1.25,
    examples: [
      "This maternal sacrifice pattern recurs across invertebrates.",
      "This bull's circular horns signal genetic isolation."
    ]
  },

  shocking_stat: {
    name: "shocking_stat",
    description:
      "Lead with a surprising or counterintuitive statistic",
    patterns: [
      "^\\d+%",
      "\\d+x (?:faster|better|cheaper|more)",
      "\\d+ (?:out of|in) \\d+",
      "\\$\\d+",
      "(?:only|just) \\d+",
      "\\d+ (?:billion|million|thousand)",
      "\\w+s?\\s+\\d+[.\\d]*%",
      "\\d+[.\\d]*%\\s+(?:of|higher|lower|more|less|increase|decrease|improvement|reduction)",
      "\\d+m people",
      "\\d+ (?:samples|studies|cases|posts|people|species)",
      "rates?\\s+\\d+",
      "with pair survival"
    ],
    baseWeight: 1.2,
    examples: [
      "NVIDIA's GPUs handle 95% of the world's AI training compute today.",
      "Light spectra dictate 70% of circadian entrainment.",
      "2M people just saw a 10-second clip of North Sentinel Island."
    ]
  },

  prediction: {
    name: "prediction",
    description: "Make a bold prediction about the future",
    patterns: [
      "by 20\\d\\d",
      "in \\d+ years",
      "will (?:become|be|happen|change|replace|dominate)",
      "prediction:",
      "bet:",
      "calling it now",
      "mark my words",
      "i expect",
      "likely (?:to |become|within)",
      "within \\d+ (?:months|years)"
    ],
    baseWeight: 1.15,
    examples: [
      "By 2027, every developer will use AI agents daily.",
      "I expect this convergence within 3 years."
    ]
  },

  before_after: {
    name: "before_after",
    description: "Show transformation through before/after contrast",
    patterns: [
      "before[\\s:].*after",
      "from\\s+\\w+.*\\s+to\\s+\\w+",
      "went from",
      "used to .* now",
      "transformation",
      "changed everything",
      "the (?:move|skill|transition|shift) from"
    ],
    baseWeight: 1.2,
    examples: [
      "Before: 4 hours of coding. After: 15 minutes with Claude.",
      "The skill move from coding to app or agent orchestration."
    ]
  },

  secret_reveal: {
    name: "secret_reveal",
    description: "Promise insider knowledge others don't have",
    patterns: [
      "nobody (?:talks|knows|mentions)",
      "(?:they|people) don.t (?:tell|mention|want)",
      "insider",
      "behind (?:the|closed) (?:scenes|doors)",
      "the (?:real|hidden|untold)",
      "what .* won.t tell you"
    ],
    baseWeight: 1.25,
    examples: [
      "Nobody talks about why GPT-4 actually fails at reasoning.",
      "The hidden cost of AI agents that nobody mentions."
    ]
  },

  social_proof: {
    name: "social_proof",
    description: "Lead with authority, experience, or proven results",
    patterns: [
      "after \\d+ years",
      "(?:built|shipped|launched) \\d+",
      "\\d+ (?:users|customers|clients)",
      "(?:top|best|leading) \\d+%",
      "worked (?:with|at|for)",
      "(?:generated|made|earned) \\$",
      "i.ve been (?:building|working|running|doing)",
      "(?:for|over) the (?:past|last) (?:year|decade|\\d+)"
    ],
    baseWeight: 1.1,
    examples: [
      "I've been building AI automation in manufacturing for the past year.",
      "After 10 years building AI systems, here's what I've learned."
    ]
  },

  declarative_claim: {
    name: "declarative_claim",
    description:
      "Bold thesis \u2014 names the constraint, mechanism, or frame directly",
    patterns: [
      "(?:is|are) the (?:binding|key|real|core|fundamental|perfect|critical|only|biggest|primary) (?:constraint|factor|variable|bottleneck|driver|advantage|testing ground|issue|problem|unlock)",
      "(?:is|are) (?:the |a )?perfect (?:testing ground|example|case|illustration)",
      "(?:requires|demands|needs|enables|unlocks|eliminates|compounds)",
      "i don.t think of .* as",
      "i think of it as",
      "(?:is|are) infrastructure",
      "building trust in",
      "the binding constraint",
      "the bottleneck"
    ],
    baseWeight: 1.3,
    examples: [
      "Brain data access is the binding constraint in neuroscience.",
      "I don't think of @RealVision as content. I think of it as infrastructure.",
      "Warehouses are the perfect testing ground for AGI-adjacent robotics."
    ]
  },

  observation: {
    name: "observation",
    description:
      "Nature/science/domain insight \u2014 reveals mechanism without personal framing",
    patterns: [
      "reveal",
      "demonstrat",
      "illustrat",
      "highlight",
      ".s strategy",
      ".s efficiency",
      ".s (?:approach|method|mechanism|design|structure|anatomy|behavior)",
      "form(?:s|ing)? lifelong",
      "target(?:s|ing)?",
      "mimic",
      "exploit(?:s|ing)?",
      "amplif(?:y|ies|ying)",
      "drift(?:ed|ing)?",
      "evolv(?:ed|ing)?",
      "adapt(?:ed|ing)?",
      "emerg(?:ed|ing)?",
      "at (?:peak|optimal|maximum|minimum)",
      "clocks in at",
      "routine clocks",
      "mimicking",
      "nature.s"
    ],
    baseWeight: 1.15,
    examples: [
      "The vulture's strategy reveals nature's efficiency.",
      "Katelyn Ohashi's routine clocks in at peak metabolic efficiency.",
      "Grayanotoxins in mad honey target sodium channels, mimicking low-dose."
    ]
  },

  direct_challenge: {
    name: "direct_challenge",
    description:
      "Challenge what the reader is currently doing \u2014 names their behavior and consequence",
    patterns: [
      "you.re [\\w\\s]+ (?:like|as if|wrong|too)",
      "that.s why (?:your|you)",
      "you.re still",
      "you keep",
      "you think .* but",
      "stop [\\w\\s]+ like"
    ],
    baseWeight: 1.35,
    examples: [
      "You're prompting AI like it's Google. That's why your outputs sound generic.",
      "You're still treating health like a todo list. That's why nothing sticks.",
      "You think more data means better decisions. But most of your inputs are noise."
    ]
  },

  stolen_thought: {
    name: "stolen_thought",
    description:
      "Name an uncomfortable truth the reader already knows but won't say",
    patterns: [
      "you already know",
      "you.ve felt this",
      "you won.t (?:say|admit)",
      "you know this but",
      "nobody (?:says|admits) it,? but you",
      "deep down,? you"
    ],
    baseWeight: 1.3,
    examples: [
      "You already know most AI tools won't matter in 2 years. You just won't say it at work.",
      "You've felt this too. The newsletter stack grew but your clarity didn't.",
      "You already know willpower doesn't work. You just haven't found the system yet."
    ]
  },

  absurd_reframe: {
    name: "absurd_reframe",
    description:
      "Give mundane thing dramatic stakes to create a pattern interrupt",
    patterns: [
      "has \\d[\\d.]* seconds? to",
      "(?:most|90%|half) (?:die|fail|quit|stop|never)",
      "your (?:first|opening|next) .* (?:has|gets|survives?)",
      "\\d[\\d.]* seconds? (?:to|before|until)",
      "(?:survive|die|kill|destroy)s? (?:before|in|within)"
    ],
    baseWeight: 1.25,
    examples: [
      "Your first sentence has 1.2 seconds to survive. Most die before the reader's thumb stops.",
      "Your morning routine has more impact on cognition than any supplement. Most people skip it.",
      "Every AI demo has 3 seconds to prove it's not vaporware. Most don't survive the scroll."
    ]
  },

  binary_frame: {
    name: "binary_frame",
    description:
      "Collapse a complex landscape into two unavoidable choices",
    patterns: [
      "either .* or",
      "two (?:types|kinds|camps|paths|choices)",
      "there is no (?:third|middle|neutral)",
      "you.re (?:either|already)",
      "one of two",
      "which (?:side|camp|path)"
    ],
    baseWeight: 1.35,
    examples: [
      "Every company is making one choice about AI: integrate into core ops, or bolt it onto the edges. There is no third option.",
      "You're either building with AI agents or you're building against them. The neutral position disappeared 6 months ago."
    ]
  },

  reader_mirror: {
    name: "reader_mirror",
    description:
      "Describe the reader's exact situation so they feel seen, then deliver insight",
    patterns: [
      "^if you.re (?:a |the |over )",
      "^you.ve been",
      "^you know (?:that|the) feeling",
      "^every (?:cto|founder|engineer|developer|leader)",
      "^the (?:cto|founder|engineer|developer) who",
      "^you.re (?:sitting|staring|wondering|reading)"
    ],
    baseWeight: 1.3,
    examples: [
      "If you're a CTO who just got asked about AI strategy by your board and you're not sure you understand it well enough to lead the conversation -- that's not a knowledge gap. It's a framing gap.",
      "You've been reading AI takes for 2 years. You still can't tell which ones will matter in 6 months. That's not a you problem. It's a signal-to-noise problem."
    ]
  },

  amplification: {
    name: "amplification",
    description:
      "Reply that adds analytical value \u2014 agrees, extends, or challenges with substance",
    patterns: ["^@\\w+\\s+\\w+"],
    baseWeight: 1.0,
    examples: [
      "@Rainmaker1973 2M people just saw a 10-second clip of North Sentinel Island.",
      "@argosaki Brilliant design. How hard is it to manufacture?",
      "@TansuYegen The flower unfolding animation is a nice touch."
    ]
  }
}

/** Effective hook type definition with user overrides applied. */
interface EffectiveHookType extends HookTypeDefinition {
  enabled: boolean
}

/** Get all hook types with user config overrides applied. */
export function getEffectiveHookTypes(
  config?: HookTypesConfig
): Record<HookTypeName, EffectiveHookType> {
  const cfg = config ?? getHookTypesConfig()
  const result = {} as Record<HookTypeName, EffectiveHookType>

  for (const [name, def] of Object.entries(HOOK_TYPES)) {
    const hookName = name as HookTypeName
    const override = cfg.overrides[hookName]
    result[hookName] = {
      ...def,
      enabled: override?.enabled ?? true,
      baseWeight: override?.baseWeight ?? def.baseWeight,
      patterns: [
        ...def.patterns,
        ...(override?.customPatterns ?? [])
      ]
    }
  }

  return result
}

/**
 * Classify the hook type of a piece of text.
 * Priority: specific types win over generic ones. Amplification is fallback
 * for @replies that don't match a more specific type.
 */
export function classifyHookType(
  text: string,
  config?: HookTypesConfig
): [HookTypeName | null, number] {
  if (!text) return [null, 0.0]

  const textLower = text.toLowerCase().trim()
  const effectiveTypes = getEffectiveHookTypes(config)

  // Score all types
  const scores: Partial<Record<HookTypeName, number>> = {}

  for (const [hookName, hookType] of Object.entries(effectiveTypes)) {
    if (!hookType.enabled) continue
    let matches = 0
    for (const pattern of hookType.patterns) {
      try {
        if (new RegExp(pattern, "i").test(textLower)) {
          matches++
        }
      } catch {
        // Skip invalid user-added patterns
      }
    }
    if (matches > 0) {
      scores[hookName as HookTypeName] = matches
    }
  }

  const scoreKeys = Object.keys(scores) as HookTypeName[]
  if (scoreKeys.length === 0) return [null, 0.0]

  // If amplification matched AND a more specific type also matched,
  // prefer the specific type
  if ("amplification" in scores && scoreKeys.length > 1) {
    delete scores.amplification
  }

  // Pick highest match count
  const remaining = Object.entries(scores) as [HookTypeName, number][]
  remaining.sort((a, b) => b[1] - a[1])
  const [bestMatch, bestCount] = remaining[0]
  const bestConfidence = Math.min(1.0, bestCount * 0.4)

  return [bestMatch, bestConfidence]
}

/** Get the base performance weight for a hook type (with config overlay). */
export function getHookTypeWeight(
  hookType: string,
  config?: HookTypesConfig
): number {
  const cfg = config ?? getHookTypesConfig()
  if (hookType in HOOK_TYPES) {
    const name = hookType as HookTypeName
    return cfg.overrides[name]?.baseWeight ?? HOOK_TYPES[name].baseWeight
  }
  return 1.0
}

/** Get example hooks for a given type. */
export function getHookExamples(
  hookType: string,
  limit: number = 3
): string[] {
  if (hookType in HOOK_TYPES) {
    return HOOK_TYPES[hookType as HookTypeName].examples.slice(0, limit)
  }
  return []
}

/** Get list of all hook type names. */
export function getAllHookTypes(): HookTypeName[] {
  return Object.keys(HOOK_TYPES) as HookTypeName[]
}

/** Get the description for a hook type. */
export function getHookDescription(hookType: string): string {
  if (hookType in HOOK_TYPES) {
    return HOOK_TYPES[hookType as HookTypeName].description
  }
  return ""
}

/** Humanize a hook type name: "data_reveal" \u2192 "Data Reveal" */
export function humanizeHookType(hookType: string): string {
  return hookType
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}
