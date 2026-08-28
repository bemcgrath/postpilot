import type { VoiceFingerprint, DiagnosticTip } from "./voice-types"

/** Common words that don't indicate a distinctive voice. */
const GENERIC_WORDS = new Set([
  "people", "business", "money", "success", "life", "world", "today",
  "better", "best", "start", "build", "learn", "grow", "help", "change",
  "need", "real", "hard", "simple", "important", "different", "free"
])

/** Analyze a voice fingerprint and return actionable diagnostic tips. */
export function diagnoseFingerprint(
  fp: VoiceFingerprint,
  postCount: number
): DiagnosticTip[] {
  const tips: DiagnosticTip[] = []

  // Data quantity
  if (postCount > 0 && postCount < 10) {
    tips.push({
      severity: "warning",
      category: "Data",
      message: `Only ${postCount} posts — add 10+ for better accuracy`
    })
  } else if (postCount >= 10 && postCount < 15) {
    tips.push({
      severity: "info",
      category: "Data",
      message: `${postCount} posts is moderate — 15+ gives the best results`
    })
  }

  // Weak signature words
  const sigWordCount = fp.distinctiveTerms.length
  if (sigWordCount < 5) {
    tips.push({
      severity: "warning",
      category: "Vocabulary",
      message: `Only ${sigWordCount} signature word${sigWordCount === 1 ? "" : "s"} detected — scoring will be lenient`
    })
  }

  // Generic vocabulary detection
  const genericCount = fp.distinctiveTerms
    .slice(0, 10)
    .filter((t) => GENERIC_WORDS.has(t.term)).length
  if (genericCount >= 4) {
    tips.push({
      severity: "warning",
      category: "Vocabulary",
      message: "Your top words are common — add niche-specific posts for better matching"
    })
  }

  // Niche keyword gaps
  if (fp.nicheKeywords.length < 3) {
    tips.push({
      severity: "warning",
      category: "Niche",
      message: `Only ${fp.nicheKeywords.length} niche keyword${fp.nicheKeywords.length === 1 ? "" : "s"} found — import a niche spec or add topic-focused posts`
    })
  }

  // Length variance
  if (fp.postLength.stdDev > 0 && fp.postLength.max > 0) {
    const cv = fp.postLength.stdDev / fp.postLength.mean
    if (cv > 0.6) {
      tips.push({
        severity: "info",
        category: "Length",
        message: "Post lengths vary widely — set a preferred range below to tighten scoring"
      })
    }
  }

  // Tone blind spots — low first/second person
  if (fp.firstPersonRatio < 0.2 && fp.secondPersonRatio < 0.2) {
    tips.push({
      severity: "info",
      category: "Tone",
      message: "Low first & second person usage — adjust below if that doesn't match your voice"
    })
  } else if (fp.firstPersonRatio < 0.2) {
    tips.push({
      severity: "info",
      category: "Tone",
      message: "Low first-person usage detected — adjust below if you typically use I/my"
    })
  } else if (fp.secondPersonRatio < 0.2) {
    tips.push({
      severity: "info",
      category: "Tone",
      message: "Low second-person usage detected — adjust below if you typically address the reader"
    })
  }

  // Hook type coverage
  if (fp.topHookTypes.length === 0) {
    tips.push({
      severity: "warning",
      category: "Hooks",
      message: "No hook patterns detected — select your preferred hook types below"
    })
  }

  return tips
}
