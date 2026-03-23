import type { GovernorIssue, GovernorResult } from "./types"
import type { GovernorConfig } from "~config/types"

import { getGovernorConfig } from "~config/config-storage"

/** Emoji detection pattern. */
const EMOJI_PATTERN =
  /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}]+/gu

/** Safely compile a regex pattern string. Returns null on invalid patterns. */
function safeRegex(pattern: string, flags: string = "i"): RegExp | null {
  try {
    return new RegExp(pattern, flags)
  } catch {
    return null
  }
}

/** Run all governor checks on post text. */
export function checkGovernor(
  text: string,
  config?: GovernorConfig
): GovernorResult {
  const cfg = config ?? getGovernorConfig()
  const issues: GovernorIssue[] = []
  let hasBannedPhrases = false
  let hasWeakPhrases = false
  let hasLengthWarning = false
  let hasEmoji = false

  // Banned phrases (errors)
  for (const entry of cfg.bannedPhrases) {
    if (!entry.enabled) continue
    const re = safeRegex(entry.pattern)
    if (!re) continue
    const match = text.match(re)
    if (match) {
      hasBannedPhrases = true
      issues.push({
        severity: "error",
        message: "Banned phrase detected",
        matchedText: match[0]
      })
    }
  }

  // Weak phrases (warnings)
  for (const entry of cfg.weakPhrases) {
    if (!entry.enabled) continue
    const re = safeRegex(entry.pattern)
    if (!re) continue
    const match = text.match(re)
    if (match) {
      hasWeakPhrases = true
      issues.push({
        severity: "warning",
        message: "Weak/generic phrase",
        matchedText: match[0]
      })
    }
  }

  // Fabrication patterns (warnings)
  for (const entry of cfg.fabricationPatterns) {
    if (!entry.enabled) continue
    const re = safeRegex(entry.pattern)
    if (!re) continue
    const match = text.match(re)
    if (match) {
      issues.push({
        severity: "warning",
        message: `Possible fabrication: ${entry.label ?? "Unverified claim"}`,
        matchedText: match[0]
      })
    }
  }

  // Fabricated stats (errors)
  for (const entry of cfg.fabricatedStatsPatterns) {
    if (!entry.enabled) continue
    const re = safeRegex(entry.pattern)
    if (!re) continue
    const match = text.match(re)
    if (match) {
      hasBannedPhrases = true
      issues.push({
        severity: "error",
        message: `Fabricated statistic: ${entry.label ?? "Invented statistic"}`,
        matchedText: match[0]
      })
    }
  }

  // Emoji check
  if (cfg.emojiWarningEnabled) {
    const emojiMatch = text.match(EMOJI_PATTERN)
    if (emojiMatch) {
      hasEmoji = true
      issues.push({
        severity: "warning",
        message: "Contains emoji",
        matchedText: emojiMatch[0]
      })
    }
  }

  // Length checks
  const charCount = text.length
  if (charCount > cfg.lengthErrorThreshold) {
    hasLengthWarning = true
    issues.push({
      severity: "error",
      message: `Way too long: ${charCount} chars (max ${cfg.lengthErrorThreshold})`
    })
  } else if (charCount > cfg.lengthWarningThreshold) {
    hasLengthWarning = true
    issues.push({
      severity: "warning",
      message: `Over ideal length: ${charCount} chars (target 280-320, max ${cfg.lengthWarningThreshold})`
    })
  }

  return {
    issues,
    hasBannedPhrases,
    hasWeakPhrases,
    hasLengthWarning,
    hasEmoji
  }
}
