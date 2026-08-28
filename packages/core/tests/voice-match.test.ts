import { describe, expect, it } from "vitest"

import { extractFingerprint } from "../src/scoring/voice-fingerprint"
import { scoreVoiceMatch } from "../src/scoring/voice-match"

const SAMPLE_POSTS = [
  "I tracked 50 AI agents for 90 days. Here's what the data showed:\n\nMost fail silently. The ones that work share 3 patterns.",
  "87% of AI projects fail before reaching production.\n\nThe bottleneck isn't the model. It's the data pipeline.",
  "Every CTO I've talked to this year says the same thing:\n\nThey don't need more AI tools. They need fewer, better ones.",
  "You're prompting AI like it's Google.\n\nThat's why your outputs sound generic.\n\nHere's the fix:",
  "The window for building AI agents is closing faster than most realize.\n\nIn 18 months, the infrastructure layer will be commoditized.",
  "I lost $50K testing autonomous agents in production.\n\nHere's what I learned about failure modes.",
  "Nobody talks about the real cost of AI adoption:\n\nIt's not the API bill. It's the organizational rewiring.",
  "Two types of companies right now:\n\nThose building AI into core ops.\nThose bolting it onto the edges.\n\nThere is no third option.",
  "If you're a CTO who just got asked about AI strategy by your board and you're not sure you understand it well enough -- that's not a knowledge gap. It's a framing gap.",
  "I've been building AI automation for the past year.\n\nThe biggest surprise? The hard part isn't the AI. It's the humans."
]

const fp = extractFingerprint(SAMPLE_POSTS)

describe("scoreVoiceMatch", () => {
  it("returns totalScore 0-100", () => {
    const result = scoreVoiceMatch("Testing AI agents in production.", fp)
    expect(result.totalScore).toBeGreaterThanOrEqual(0)
    expect(result.totalScore).toBeLessThanOrEqual(100)
  })

  it("returns 7 dimensions", () => {
    const result = scoreVoiceMatch("Some text here.", fp)
    expect(result.dimensions).toHaveLength(7)
  })

  it("dimension weights sum to 1.0", () => {
    const result = scoreVoiceMatch("Test.", fp)
    const weightSum = result.dimensions.reduce((s, d) => s + d.weight, 0)
    expect(weightSum).toBeCloseTo(1.0, 5)
  })

  it("each dimension has score 0-100", () => {
    const result = scoreVoiceMatch(
      "I tracked 50 AI agents and here's what the data showed about failure modes.",
      fp
    )
    for (const dim of result.dimensions) {
      expect(dim.score).toBeGreaterThanOrEqual(0)
      expect(dim.score).toBeLessThanOrEqual(100)
    }
  })

  it("scores matching voice higher than non-matching", () => {
    const matching = scoreVoiceMatch(
      "I tested 30 AI tools in production.\n\nHere's what I learned about the real bottleneck:",
      fp
    )
    const nonMatching = scoreVoiceMatch(
      "Blockchain technology continues to revolutionize the financial sector with unprecedented innovations in decentralized finance.",
      fp
    )
    expect(matching.totalScore).toBeGreaterThan(nonMatching.totalScore)
  })

  it("provides feedback for low-scoring dimensions", () => {
    const result = scoreVoiceMatch(
      "Blockchain technology continues to revolutionize the financial sector.",
      fp
    )
    const feedbackDims = result.dimensions.filter((d) => d.feedback !== null)
    expect(feedbackDims.length).toBeGreaterThan(0)
  })

  it("gives high hook style score for matching hook type", () => {
    // data_reveal should be a top hook type
    const result = scoreVoiceMatch(
      "I tracked 100 models for 60 days. Here's the data:",
      fp
    )
    const hookDim = result.dimensions.find((d) => d.name === "Hook Style")
    expect(hookDim!.score).toBeGreaterThanOrEqual(60)
  })

  it("gives high vocabulary score when using signature words", () => {
    const result = scoreVoiceMatch(
      "The AI agents failed in production because the data pipeline bottleneck was real.",
      fp
    )
    const vocabDim = result.dimensions.find((d) => d.name === "Vocabulary")
    expect(vocabDim!.score).toBeGreaterThanOrEqual(40)
  })

  it("gives low score for completely off-topic text", () => {
    const result = scoreVoiceMatch(
      "Beautiful sunset over the mountains today.",
      fp
    )
    expect(result.totalScore).toBeLessThan(60)
  })

  it("handles empty text gracefully", () => {
    const result = scoreVoiceMatch("", fp)
    expect(result.totalScore).toBeGreaterThanOrEqual(0)
    expect(result.dimensions).toHaveLength(7)
  })
})
