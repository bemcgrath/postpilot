import type { HookTypeName } from "./types"
import type { NumericProfile, VocabEntry, VoiceFingerprint, VoiceOverrides } from "./voice-types"

import { classifyHookType } from "./hook-types"

/** ~150 common English stopwords filtered from vocabulary analysis. */
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "shall", "can", "need", "must",
  "it", "its", "he", "she", "they", "them", "their", "his", "her",
  "we", "us", "our", "me", "him", "who", "what", "which", "that",
  "this", "these", "those", "there", "here", "where", "when", "how",
  "why", "all", "each", "every", "both", "few", "more", "most", "other",
  "some", "such", "no", "not", "only", "own", "same", "so", "than",
  "too", "very", "just", "about", "above", "after", "again", "against",
  "also", "am", "any", "because", "before", "below", "between", "both",
  "during", "even", "get", "got", "if", "into", "like", "make", "many",
  "much", "my", "new", "now", "one", "out", "over", "really", "right",
  "said", "say", "since", "still", "take", "tell", "then", "through",
  "under", "up", "well", "went", "while", "back", "come", "go", "going",
  "good", "great", "know", "look", "made", "much", "off", "old", "see",
  "think", "time", "thing", "things", "want", "way", "work", "year",
  "years", "your", "you", "i", "it's", "don't", "doesn't", "didn't",
  "won't", "can't", "isn't", "aren't", "wasn't", "weren't", "i'm",
  "i've", "i'll", "i'd", "you're", "you've", "you'll", "you'd",
  "he's", "she's", "it's", "we're", "they're", "they've", "they'll",
  "that's", "there's", "here's", "what's", "who's", "let's"
])

/** Social-noise words filtered from niche keyword analysis. */
const SOCIAL_NOISE = new Set([
  "post", "tweet", "thread", "retweet", "rt", "dm", "follow",
  "followers", "following", "likes", "like", "share", "comment",
  "subscribe", "content", "viral", "engagement", "algorithm",
  "platform", "social", "media", "online", "digital", "account",
  "profile", "feed", "timeline", "notification", "update", "reply",
  "mention", "hashtag", "trending", "people", "everyone", "someone"
])

/** Tokenize text into lowercase words, filtering punctuation. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1)
}

/** Compute mean, stdDev, min, max from an array of numbers. */
function numericProfile(values: number[]): NumericProfile {
  if (values.length === 0) {
    return { mean: 0, stdDev: 0, min: 0, max: 0 }
  }
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
  return {
    mean: Math.round(mean * 100) / 100,
    stdDev: Math.round(Math.sqrt(variance) * 100) / 100,
    min: Math.min(...values),
    max: Math.max(...values)
  }
}

/** Extract a voice fingerprint from a collection of sample posts. */
export function extractFingerprint(posts: string[]): VoiceFingerprint {
  const totalPosts = posts.length

  // 1. Vocabulary — tokenize, filter stopwords, keep terms in 2+ posts
  const termPostCounts = new Map<string, number>()
  for (const post of posts) {
    const uniqueTerms = new Set(tokenize(post).filter((w) => !STOPWORDS.has(w)))
    for (const term of uniqueTerms) {
      termPostCounts.set(term, (termPostCounts.get(term) ?? 0) + 1)
    }
  }
  const distinctiveTerms: VocabEntry[] = Array.from(termPostCounts.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([term, count]) => ({
      term,
      count,
      frequency: Math.round((count / totalPosts) * 100) / 100
    }))

  // 2. Sentence structure
  const allSentenceLengths: number[] = []
  let totalSentences = 0
  let fragmentCount = 0
  for (const post of posts) {
    const sentences = post
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
    for (const sentence of sentences) {
      const wordCount = sentence.split(/\s+/).length
      allSentenceLengths.push(wordCount)
      totalSentences++
      if (wordCount <= 5) fragmentCount++
    }
  }
  const sentenceLength = numericProfile(allSentenceLengths)
  const fragmentRatio =
    totalSentences > 0
      ? Math.round((fragmentCount / totalSentences) * 100) / 100
      : 0

  // 3. Hook types — classify each post
  const hookCounts: Partial<Record<HookTypeName, number>> = {}
  for (const post of posts) {
    const [hookType] = classifyHookType(post)
    if (hookType) {
      hookCounts[hookType] = (hookCounts[hookType] ?? 0) + 1
    }
  }
  const hookTypeDistribution: Partial<Record<HookTypeName, number>> = {}
  for (const [type, count] of Object.entries(hookCounts)) {
    hookTypeDistribution[type as HookTypeName] =
      Math.round((count / totalPosts) * 100) / 100
  }
  const topHookTypes = Object.entries(hookCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type]) => type as HookTypeName)

  // 4. Post length
  const postLengths = posts.map((p) => p.length)
  const postLength = numericProfile(postLengths)

  // 5. Tone — question, exclamation, first/second person, formality
  let questionPosts = 0
  let exclamationPosts = 0
  let firstPersonPosts = 0
  let secondPersonPosts = 0
  for (const post of posts) {
    if (/\?/.test(post)) questionPosts++
    if (/!/.test(post)) exclamationPosts++
    if (/\b(i|i'm|i've|i'll|i'd|my|mine|myself)\b/i.test(post))
      firstPersonPosts++
    if (/\b(you|you're|you've|you'll|you'd|your|yours|yourself)\b/i.test(post))
      secondPersonPosts++
  }
  const questionRatio = Math.round((questionPosts / totalPosts) * 100) / 100
  const exclamationRatio =
    Math.round((exclamationPosts / totalPosts) * 100) / 100
  const firstPersonRatio =
    Math.round((firstPersonPosts / totalPosts) * 100) / 100
  const secondPersonRatio =
    Math.round((secondPersonPosts / totalPosts) * 100) / 100

  // Formality: higher = more formal. Deducted by contractions, first person, fragments
  const contractionCount = posts
    .join(" ")
    .match(/\b\w+'\w+\b/g)?.length ?? 0
  const avgContractions = contractionCount / totalPosts
  const formalityScore = Math.round(
    Math.max(0, Math.min(1,
      1 - firstPersonRatio * 0.3 - fragmentRatio * 0.3 - Math.min(avgContractions / 5, 0.4)
    )) * 100
  ) / 100

  // 6. Niche keywords — same as vocab but with social-noise filter
  const nicheKeywords: VocabEntry[] = Array.from(termPostCounts.entries())
    .filter(
      ([term, count]) =>
        count >= 2 && !STOPWORDS.has(term) && !SOCIAL_NOISE.has(term)
    )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([term, count]) => ({
      term,
      count,
      frequency: Math.round((count / totalPosts) * 100) / 100
    }))

  // 7. Structure — line breaks, paragraphs, colons, lists
  const lineBreakCounts = posts.map(
    (p) => (p.match(/\n/g) ?? []).length
  )
  const lineBreakFrequency = numericProfile(lineBreakCounts)
  const paragraphCounts = posts.map(
    (p) => p.split(/\n\n+/).filter((s) => s.trim().length > 0).length
  )
  const avgParagraphs =
    Math.round(
      (paragraphCounts.reduce((a, b) => a + b, 0) / totalPosts) * 100
    ) / 100
  const colonPosts = posts.filter((p) => /:/.test(p)).length
  const usesColons = Math.round((colonPosts / totalPosts) * 100) / 100
  const listPosts = posts.filter((p) => /^[\s]*[-•*]\s/m.test(p)).length
  const usesLists = Math.round((listPosts / totalPosts) * 100) / 100

  return {
    generatedAt: Date.now(),
    sampleCount: totalPosts,
    distinctiveTerms,
    sentenceLength,
    fragmentRatio,
    hookTypeDistribution,
    topHookTypes,
    postLength,
    questionRatio,
    exclamationRatio,
    firstPersonRatio,
    secondPersonRatio,
    formalityScore,
    nicheKeywords,
    lineBreakFrequency,
    avgParagraphs,
    usesColons,
    usesLists
  }
}

/** Apply manual overrides to a fingerprint, returning a new modified copy. */
export function applyOverrides(
  fp: VoiceFingerprint,
  overrides: VoiceOverrides
): VoiceFingerprint {
  const result = { ...fp }

  // Signature words: remove then add
  if (overrides.removeSignatureWords.length > 0) {
    const removeSet = new Set(overrides.removeSignatureWords.map((w) => w.toLowerCase()))
    result.distinctiveTerms = result.distinctiveTerms.filter(
      (t) => !removeSet.has(t.term.toLowerCase())
    )
  }
  if (overrides.addSignatureWords.length > 0) {
    const existing = new Set(result.distinctiveTerms.map((t) => t.term.toLowerCase()))
    const toAdd: VocabEntry[] = overrides.addSignatureWords
      .filter((w) => !existing.has(w.toLowerCase()))
      .map((w) => ({ term: w.toLowerCase(), count: 1, frequency: 1 }))
    result.distinctiveTerms = [...result.distinctiveTerms, ...toAdd]
  }

  // Niche keywords: remove then add
  if (overrides.removeNicheKeywords.length > 0) {
    const removeSet = new Set(overrides.removeNicheKeywords.map((w) => w.toLowerCase()))
    result.nicheKeywords = result.nicheKeywords.filter(
      (t) => !removeSet.has(t.term.toLowerCase())
    )
  }
  if (overrides.addNicheKeywords.length > 0) {
    const existing = new Set(result.nicheKeywords.map((t) => t.term.toLowerCase()))
    const toAdd: VocabEntry[] = overrides.addNicheKeywords
      .filter((w) => !existing.has(w.toLowerCase()))
      .map((w) => ({ term: w.toLowerCase(), count: 1, frequency: 1 }))
    result.nicheKeywords = [...result.nicheKeywords, ...toAdd]
  }

  // Length range
  if (overrides.lengthMin != null || overrides.lengthMax != null) {
    const min = overrides.lengthMin ?? fp.postLength.min
    const max = overrides.lengthMax ?? fp.postLength.max
    const mean = (min + max) / 2
    const stdDev = (max - min) / 4 // approximate
    result.postLength = { mean, stdDev, min, max }
  }

  // Hook preferences
  if (overrides.preferredHookTypes.length > 0) {
    result.topHookTypes = overrides.preferredHookTypes.slice(0, 3)
    const dist: Partial<Record<HookTypeName, number>> = { ...fp.hookTypeDistribution }
    for (const ht of overrides.preferredHookTypes) {
      if (!(ht in dist)) {
        dist[ht] = 0.1
      }
    }
    result.hookTypeDistribution = dist
  }

  // Tone ratios
  if (overrides.firstPersonRatio != null) {
    result.firstPersonRatio = overrides.firstPersonRatio
  }
  if (overrides.secondPersonRatio != null) {
    result.secondPersonRatio = overrides.secondPersonRatio
  }
  if (overrides.questionRatio != null) {
    result.questionRatio = overrides.questionRatio
  }
  if (overrides.exclamationRatio != null) {
    result.exclamationRatio = overrides.exclamationRatio
  }

  return result
}
