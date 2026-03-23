import type { HookScore, HookTypeName, ScoreBreakdown } from "./types"
import type { HookAnalyzerConfig } from "~config/types"

import { classifyHookType, getHookTypeWeight } from "./hook-types"
import { getHookAnalyzerConfig } from "~config/config-storage"

/** Compute patternMatch score from learned hook type boosts. */
function computePatternMatch(
  hookType: HookTypeName | null,
  boosts: Partial<Record<HookTypeName, number>> | undefined
): number {
  if (!hookType || !boosts) return 0
  const boost = boosts[hookType]
  if (boost == null) return 0
  if (boost >= 1.3) return 10
  if (boost >= 1.15) return 5
  if (boost < 0.8) return -5
  return 0
}

/**
 * Analyzes and scores hooks based on HookPoint principles.
 *
 * Scoring Components (total 0-100):
 * - Base: config.baseScore points (default 50)
 * - Hook Type Bonus: 0-config.hookTypeBonusMax points
 * - Specificity: 0-20 points (numbers, timeframes, entities)
 * - Length: 0-config.length.optimalScore points
 * - Curiosity Gap: 0-15 points
 * - Learned Pattern Match: 0 (stub for future)
 * - Penalties: negative points
 */
export class HookAnalyzer {
  /** Extract the hook (first line/sentence) from text. */
  extractHook(text: string, config?: HookAnalyzerConfig): string {
    if (!text) return ""
    const cfg = config ?? getHookAnalyzerConfig()

    text = text.trim()
    const lines = text.split("\n")
    const firstLine = lines[0].trim()

    if (firstLine.length <= cfg.hookMaxLength) {
      return firstLine
    }

    // Try first sentence
    const sentences = firstLine.split(/[.!?]/)
    if (sentences.length > 0 && sentences[0]) {
      return sentences[0].trim() + "."
    }

    return firstLine.slice(0, cfg.hookMaxLength)
  }

  /** Score a hook on the 0-100 HookPoint scale. */
  score(
    text: string,
    config?: HookAnalyzerConfig,
    hookTypeBoosts?: Partial<Record<HookTypeName, number>>
  ): HookScore {
    const cfg = config ?? getHookAnalyzerConfig()
    const hookText = this.extractHook(text, cfg)

    if (!hookText) {
      return {
        totalScore: 0,
        hookType: null,
        hookTypeConfidence: 0.0,
        hookText: "",
        breakdown: {
          base: 0,
          hookType: 0,
          specificity: 0,
          length: 0,
          curiosityGap: 0,
          patternMatch: 0,
          penalties: 0,
          penaltyReasons: []
        },
        suggestions: ["No hook text found"],
        isWeak: true
      }
    }

    const breakdown: ScoreBreakdown = {
      base: cfg.baseScore,
      hookType: 0,
      specificity: 0,
      length: 0,
      curiosityGap: 0,
      patternMatch: 0,
      penalties: 0
    }
    const suggestions: string[] = []
    let total = cfg.baseScore

    // 1. Hook Type Detection (+0-hookTypeBonusMax)
    const [hookType, typeConfidence] = classifyHookType(hookText)
    if (hookType) {
      const weight = getHookTypeWeight(hookType)
      const typeBonus = Math.max(
        0,
        Math.min(cfg.hookTypeBonusMax, Math.floor(cfg.hookTypeBonusMax * (weight - 0.85)))
      )
      total += typeBonus
      breakdown.hookType = typeBonus
    } else {
      suggestions.push(
        "Add a stronger hook pattern (data reveal, contrarian, curiosity gap)"
      )
    }

    // 2. Specificity Score (+0-20)
    const [specScore, specSuggestions] = this.scoreSpecificity(hookText, cfg)
    total += specScore
    breakdown.specificity = specScore
    suggestions.push(...specSuggestions)

    // 3. Length Score (+0-optimalScore)
    const [lengthScore, lengthSuggestion] = this.scoreLength(hookText, cfg)
    total += lengthScore
    breakdown.length = lengthScore
    if (lengthSuggestion) suggestions.push(lengthSuggestion)

    // 4. Curiosity Gap Score (+0-15)
    const [curiosityScore, curiositySuggestion] =
      this.scoreCuriosityGap(hookText, cfg)
    total += curiosityScore
    breakdown.curiosityGap = curiosityScore
    if (curiositySuggestion) suggestions.push(curiositySuggestion)

    // 5. Learned Patterns (from user's historical data)
    const patternMatch = computePatternMatch(hookType, hookTypeBoosts)
    breakdown.patternMatch = patternMatch
    total += patternMatch

    // 6. Penalties
    const [penalties, penaltySuggestions, penaltyReasons] =
      this.calculatePenalties(hookText, cfg)
    total += penalties
    breakdown.penalties = penalties
    breakdown.penaltyReasons = penaltyReasons
    suggestions.push(...penaltySuggestions)

    const totalScore = Math.max(0, Math.min(100, total))

    return {
      totalScore,
      hookType,
      hookTypeConfidence: typeConfidence,
      hookText,
      breakdown,
      suggestions: suggestions.slice(0, 5),
      isWeak: totalScore < cfg.weakThreshold
    }
  }

  private scoreSpecificity(
    text: string,
    cfg: HookAnalyzerConfig
  ): [number, string[]] {
    let score = 0
    const suggestions: string[] = []

    // Numbers
    if (/\d+/.test(text)) {
      score += cfg.specificity.numbers
    } else {
      suggestions.push("Add specific numbers for credibility")
    }

    // Timeframe
    const timeframePatterns = [
      /\d+\s*(days?|weeks?|months?|years?|hours?)/i,
      /(today|yesterday|last|this)\s*(week|month|year)/i,
      /(morning|evening|night)/i,
      /by\s*(20\d{2})/i,
      /in\s*\d+\s*(days?|weeks?|months?|years?)/i
    ]
    if (timeframePatterns.some((p) => p.test(text))) {
      score += cfg.specificity.timeframe
    } else {
      suggestions.push("Add a timeframe for urgency")
    }

    // Named entities
    const entityPatterns = [
      /@\w+/,
      /(GPT|Claude|OpenAI|Anthropic|Google|Meta|Microsoft)/,
      /(CEO|CTO|founder|researcher)/,
      /[A-Z][a-z]+\s+[A-Z][a-z]+/
    ]
    if (entityPatterns.some((p) => p.test(text))) {
      score += cfg.specificity.entity
    }

    return [score, suggestions]
  }

  private scoreLength(
    text: string,
    cfg: HookAnalyzerConfig
  ): [number, string | null] {
    const length = text.length

    if (length >= cfg.length.optimalMin && length <= cfg.length.optimalMax) {
      return [cfg.length.optimalScore, null]
    } else if (
      length >= cfg.length.acceptableMin &&
      length <= cfg.length.acceptableMax
    ) {
      return [cfg.length.acceptableScore, null]
    } else if (length < cfg.length.acceptableMin) {
      return [0, "Hook is too short - add more substance"]
    } else {
      return [
        0,
        `Hook is too long (${length} chars) - aim for ${cfg.length.optimalMin}-${cfg.length.optimalMax} chars`
      ]
    }
  }

  private scoreCuriosityGap(
    text: string,
    cfg: HookAnalyzerConfig
  ): [number, string | null] {
    let score = 0
    const textLower = text.toLowerCase()

    // Open loop indicators
    const openLoops = [
      /here's (what|why|how)/,
      /this is (what|why|how)/,
      /the (answer|reason|secret)/,
      /i (found|discovered|learned)/,
      /\.\.\.$/,
      /:$/
    ]
    if (openLoops.some((p) => p.test(textLower))) {
      score += cfg.curiosityGap.openLoopBonus
    }

    // Tension words
    const tensionWords = [
      /\bbut\b/,
      /\bhowever\b/,
      /\bactually\b/,
      /\bunexpected\b/,
      /\bsurpris/,
      /\bcontrar/,
      /\bwrong\b/
    ]
    if (tensionWords.some((p) => p.test(textLower))) {
      score += cfg.curiosityGap.tensionWordBonus
    }

    const suggestion =
      score < cfg.curiosityGap.openLoopBonus
        ? "End with a colon or 'Here's what...' to create curiosity"
        : null

    return [score, suggestion]
  }

  private calculatePenalties(
    text: string,
    cfg: HookAnalyzerConfig
  ): [number, string[], string[]] {
    let penalties = 0
    const suggestions: string[] = []
    const reasons: string[] = []
    const textLower = text.toLowerCase()

    // Generic opener penalty
    const genericOpeners = [
      /^thread:/,
      /^hot take:/,
      /^let's talk about/,
      /^thoughts on/,
      /^so\b/,
      /^okay so/,
      /^alright/,
      /^hey everyone/
    ]
    if (genericOpeners.some((p) => p.test(textLower))) {
      penalties += cfg.penalties.genericOpener
      reasons.push(`Generic opener (${cfg.penalties.genericOpener})`)
      suggestions.push(
        "Avoid generic openers like 'Thread:' or 'Let's talk about'"
      )
    }

    // Bland starts penalty
    const blandStarts = [
      /^i think/,
      /^i believe/,
      /^in my opinion/,
      /^it seems/,
      /^just/
    ]
    if (blandStarts.some((p) => p.test(textLower))) {
      penalties += cfg.penalties.blandStart
      reasons.push(`Bland opening (${cfg.penalties.blandStart})`)
      suggestions.push("Lead with data or a bold claim, not 'I think'")
    }

    // Too long penalty
    if (text.length > cfg.hookMaxLength) {
      penalties += cfg.penalties.tooLongHook
      reasons.push(`Hook over ${cfg.hookMaxLength} chars (${cfg.penalties.tooLongHook})`)
    }

    // Question without specificity
    if (text.endsWith("?") && !/\d/.test(text)) {
      penalties += cfg.penalties.questionNoNumbers
      reasons.push(`Question without numbers (${cfg.penalties.questionNoNumbers})`)
      suggestions.push("Questions work better with specific numbers")
    }

    return [penalties, suggestions, reasons]
  }
}
