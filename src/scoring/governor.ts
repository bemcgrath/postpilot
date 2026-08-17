import type { GovernorIssue, GovernorLane, GovernorResult } from "./types"
import type { GovernorConfig, PhraseEntry } from "~config/types"

import { getGovernorConfig } from "~config/config-storage"

/** Emoji detection pattern. */
const EMOJI_PATTERN =
  /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}]+/gu

/** All-caps word (4+ letters) — candidate for the SHOUTING check. */
const ALL_CAPS_WORD_PATTERN = /\b[A-Z]{4,}\b/g

/** Two or more !/? in a row, e.g. "??", "!!!", "?!". */
const SPAMMY_PUNCTUATION_PATTERN = /[!?]{2,}/

/** Hashtag pattern. */
const HASHTAG_PATTERN = /#\w+/g

/** Safely compile a regex pattern string. Returns null on invalid patterns. */
function safeRegex(pattern: string, flags: string = "i"): RegExp | null {
  try {
    return new RegExp(pattern, flags)
  } catch {
    return null
  }
}

function matchPhrases(
  text: string,
  entries: PhraseEntry[],
  lane: GovernorLane,
  severity: GovernorIssue["severity"],
  messageFor: (entry: PhraseEntry, match: string) => string
): GovernorIssue[] {
  const issues: GovernorIssue[] = []
  for (const entry of entries) {
    if (!entry.enabled) continue
    const re = safeRegex(entry.pattern)
    if (!re) continue
    const match = text.match(re)
    if (match) {
      issues.push({
        severity,
        lane,
        message: messageFor(entry, match[0]),
        matchedText: match[0]
      })
    }
  }
  return issues
}

/** Run all governor checks on post text. */
export function checkGovernor(
  text: string,
  config?: GovernorConfig
): GovernorResult {
  const cfg = config ?? getGovernorConfig()
  const issues: GovernorIssue[] = []

  issues.push(
    ...matchPhrases(
      text,
      cfg.bannedPhrases,
      "banned",
      "error",
      () => "Banned phrase detected"
    )
  )
  issues.push(
    ...matchPhrases(
      text,
      cfg.weakPhrases,
      "weak",
      "warning",
      () => "Weak/generic phrase"
    )
  )
  issues.push(
    ...matchPhrases(
      text,
      cfg.aiSlopPhrases,
      "slop",
      "error",
      (_entry, match) => `AI slop: "${match}"`
    )
  )
  issues.push(
    ...matchPhrases(
      text,
      cfg.fabricationPatterns,
      "fabrication",
      "warning",
      (entry) => `Possible fabrication: ${entry.label ?? "Unverified claim"}`
    )
  )
  issues.push(
    ...matchPhrases(
      text,
      cfg.fabricatedStatsPatterns,
      "fabrication",
      "error",
      (entry) => `Fabricated statistic: ${entry.label ?? "Invented statistic"}`
    )
  )

  let hasEmoji = false
  let hasAllCaps = false
  let hasSpammyPunctuation = false
  let hasExcessHashtags = false
  let hasLengthWarning = false

  if (cfg.emojiWarningEnabled) {
    const emojiMatch = text.match(EMOJI_PATTERN)
    if (emojiMatch) {
      hasEmoji = true
      issues.push({
        severity: "warning",
        lane: "structure",
        message: "Contains emoji",
        matchedText: emojiMatch[0]
      })
    }
  }

  if (cfg.allCapsWarningEnabled) {
    const capsWords = text.match(ALL_CAPS_WORD_PATTERN) ?? []
    const shouting = capsWords.filter(
      (w) => !cfg.allCapsAllowlist.includes(w)
    )
    if (shouting.length > 0) {
      hasAllCaps = true
      issues.push({
        severity: "warning",
        lane: "structure",
        message: "All-caps word reads as shouting",
        matchedText: shouting[0]
      })
    }
  }

  if (cfg.spammyPunctuationWarningEnabled) {
    const match = text.match(SPAMMY_PUNCTUATION_PATTERN)
    if (match) {
      hasSpammyPunctuation = true
      issues.push({
        severity: "warning",
        lane: "structure",
        message: "Spammy punctuation (repeated !/?)",
        matchedText: match[0]
      })
    }
  }

  if (cfg.hashtagWarningEnabled) {
    const hashtags = text.match(HASHTAG_PATTERN) ?? []
    if (hashtags.length > cfg.hashtagLimit) {
      hasExcessHashtags = true
      issues.push({
        severity: "warning",
        lane: "structure",
        message: `Too many hashtags (${hashtags.length}, keep to ${cfg.hashtagLimit} or fewer)`
      })
    }
  }

  const charCount = text.length
  if (charCount > cfg.lengthErrorThreshold) {
    hasLengthWarning = true
    issues.push({
      severity: "error",
      lane: "structure",
      message: `Way too long: ${charCount} chars (max ${cfg.lengthErrorThreshold})`
    })
  } else if (charCount > cfg.lengthWarningThreshold) {
    hasLengthWarning = true
    issues.push({
      severity: "warning",
      lane: "structure",
      message: `Over ideal length: ${charCount} chars (target 280-320, max ${cfg.lengthWarningThreshold})`
    })
  }

  return {
    issues,
    hasBannedPhrases: issues.some((i) => i.lane === "banned"),
    hasWeakPhrases: issues.some((i) => i.lane === "weak"),
    hasAiSlop: issues.some((i) => i.lane === "slop"),
    hasFabrication: issues.some((i) => i.lane === "fabrication"),
    hasLengthWarning,
    hasEmoji,
    hasAllCaps,
    hasSpammyPunctuation,
    hasExcessHashtags
  }
}
