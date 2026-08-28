import type { VoiceFingerprint, VoiceMatchDimension, VoiceMatchResult } from "./voice-types"

import { classifyHookType } from "./hook-types"

/** Score how well a draft matches a voice fingerprint. */
export function scoreVoiceMatch(
  text: string,
  fingerprint: VoiceFingerprint
): VoiceMatchResult {
  const dimensions: VoiceMatchDimension[] = [
    scoreHookStyle(text, fingerprint),
    scoreVocabulary(text, fingerprint),
    scoreLengthMatch(text, fingerprint),
    scoreTone(text, fingerprint),
    scoreNicheKeywords(text, fingerprint),
    scoreSentenceStructure(text, fingerprint),
    scoreStructure(text, fingerprint)
  ]

  const totalScore = Math.round(
    dimensions.reduce((sum, d) => sum + d.score * d.weight, 0)
  )

  return { totalScore, dimensions }
}

function scoreHookStyle(
  text: string,
  fp: VoiceFingerprint
): VoiceMatchDimension {
  const [hookType] = classifyHookType(text)
  let score = 30 // unknown baseline

  if (hookType) {
    if (fp.topHookTypes.includes(hookType)) {
      score = 100
    } else if (hookType in fp.hookTypeDistribution) {
      score = 60
    }
  }

  return {
    name: "Hook Style",
    score,
    weight: 0.2,
    feedback:
      score < 60 && fp.topHookTypes.length > 0
        ? `Your top hook styles: ${fp.topHookTypes.join(", ").replace(/_/g, " ")}`
        : null
  }
}

function scoreVocabulary(
  text: string,
  fp: VoiceFingerprint
): VoiceMatchDimension {
  const textLower = text.toLowerCase()
  const matchCount = fp.distinctiveTerms.filter((t) =>
    new RegExp(`\\b${escapeRegex(t.term)}\\b`).test(textLower)
  ).length

  let score: number
  if (matchCount >= 3) score = 100
  else if (matchCount === 2) score = 75
  else if (matchCount === 1) score = 40
  else score = 0

  return {
    name: "Vocabulary",
    score,
    weight: 0.2,
    feedback:
      score < 60
        ? `Use more of your signature words (${fp.distinctiveTerms.slice(0, 5).map((t) => t.term).join(", ")})`
        : null
  }
}

function scoreLengthMatch(
  text: string,
  fp: VoiceFingerprint
): VoiceMatchDimension {
  const z = fp.postLength.stdDev > 0
    ? Math.abs(text.length - fp.postLength.mean) / fp.postLength.stdDev
    : 0
  const score = Math.max(0, Math.round(100 - z * 30))

  return {
    name: "Length",
    score,
    weight: 0.15,
    feedback:
      score < 60
        ? `Your posts are usually ${Math.round(fp.postLength.mean)} chars (this is ${text.length})`
        : null
  }
}

function scoreTone(
  text: string,
  fp: VoiceFingerprint
): VoiceMatchDimension {
  let score = 0

  // Question match (25 pts)
  const hasQuestion = /\?/.test(text)
  const questionMatch = hasQuestion === fp.questionRatio > 0.3
  if (questionMatch) score += 25

  // Exclamation match (25 pts)
  const hasExclamation = /!/.test(text)
  const exclamationMatch = hasExclamation === fp.exclamationRatio > 0.3
  if (exclamationMatch) score += 25

  // First person match (25 pts)
  const hasFirstPerson = /\b(i|i'm|i've|i'll|i'd|my|mine|myself)\b/i.test(text)
  const firstPersonMatch = hasFirstPerson === fp.firstPersonRatio > 0.5
  if (firstPersonMatch) score += 25

  // Second person match (25 pts)
  const hasSecondPerson =
    /\b(you|you're|you've|you'll|you'd|your|yours|yourself)\b/i.test(text)
  const secondPersonMatch = hasSecondPerson === fp.secondPersonRatio > 0.3
  if (secondPersonMatch) score += 25

  const feedbackParts: string[] = []
  if (score < 60) {
    if (fp.firstPersonRatio > 0.5 && !hasFirstPerson)
      feedbackParts.push("you usually write in first person")
    if (fp.secondPersonRatio > 0.3 && !hasSecondPerson)
      feedbackParts.push("you usually address the reader directly")
  }

  return {
    name: "Tone",
    score,
    weight: 0.15,
    feedback: feedbackParts.length > 0 ? feedbackParts.join("; ") : null
  }
}

function scoreNicheKeywords(
  text: string,
  fp: VoiceFingerprint
): VoiceMatchDimension {
  const textLower = text.toLowerCase()
  const matchCount = fp.nicheKeywords.filter((t) =>
    new RegExp(`\\b${escapeRegex(t.term)}\\b`).test(textLower)
  ).length

  let score: number
  if (matchCount >= 2) score = 100
  else if (matchCount === 1) score = 50
  else score = 0

  return {
    name: "Niche Keywords",
    score,
    weight: 0.1,
    feedback:
      score < 60
        ? `Your niche topics: ${fp.nicheKeywords.slice(0, 5).map((t) => t.term).join(", ")}`
        : null
  }
}

function scoreSentenceStructure(
  text: string,
  fp: VoiceFingerprint
): VoiceMatchDimension {
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  if (sentences.length === 0) {
    return { name: "Sentence Structure", score: 50, weight: 0.1, feedback: null }
  }

  const avgWordCount =
    sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) /
    sentences.length
  const fragRatio =
    sentences.filter((s) => s.split(/\s+/).length <= 5).length /
    sentences.length

  // Z-score on avg sentence length
  const zLen =
    fp.sentenceLength.stdDev > 0
      ? Math.abs(avgWordCount - fp.sentenceLength.mean) / fp.sentenceLength.stdDev
      : 0
  const lenScore = Math.max(0, 100 - zLen * 30)

  // Fragment ratio diff
  const fragDiff = Math.abs(fragRatio - fp.fragmentRatio)
  const fragScore = Math.max(0, 100 - fragDiff * 200)

  const score = Math.round((lenScore + fragScore) / 2)

  return {
    name: "Sentence Structure",
    score,
    weight: 0.1,
    feedback:
      score < 60
        ? `Your sentences avg ${Math.round(fp.sentenceLength.mean)} words; ${Math.round(fp.fragmentRatio * 100)}% are short fragments`
        : null
  }
}

function scoreStructure(
  text: string,
  fp: VoiceFingerprint
): VoiceMatchDimension {
  const lineBreaks = (text.match(/\n/g) ?? []).length
  const hasColon = /:/.test(text)
  const hasList = /^[\s]*[-•*]\s/m.test(text)

  // Z-score on line breaks
  const zBreaks =
    fp.lineBreakFrequency.stdDev > 0
      ? Math.abs(lineBreaks - fp.lineBreakFrequency.mean) /
        fp.lineBreakFrequency.stdDev
      : 0
  const breakScore = Math.max(0, 100 - zBreaks * 30)

  // Colon/list usage match
  let formatScore = 0
  const colonExpected = fp.usesColons > 0.3
  const listExpected = fp.usesLists > 0.3
  if (hasColon === colonExpected) formatScore += 50
  if (hasList === listExpected) formatScore += 50

  const score = Math.round((breakScore + formatScore) / 2)

  return {
    name: "Structure",
    score,
    weight: 0.1,
    feedback:
      score < 60
        ? `Your posts typically use ${Math.round(fp.lineBreakFrequency.mean)} line breaks`
        : null
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
