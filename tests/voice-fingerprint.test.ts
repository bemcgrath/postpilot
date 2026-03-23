import { describe, expect, it } from "vitest"

import { extractFingerprint } from "../src/scoring/voice-fingerprint"

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

describe("extractFingerprint", () => {
  const fp = extractFingerprint(SAMPLE_POSTS)

  it("records correct sample count", () => {
    expect(fp.sampleCount).toBe(10)
  })

  it("sets generatedAt timestamp", () => {
    expect(fp.generatedAt).toBeGreaterThan(0)
  })

  it("extracts distinctive terms that appear in 2+ posts", () => {
    expect(fp.distinctiveTerms.length).toBeGreaterThan(0)
    expect(fp.distinctiveTerms.length).toBeLessThanOrEqual(30)
    for (const term of fp.distinctiveTerms) {
      expect(term.count).toBeGreaterThanOrEqual(2)
      expect(term.frequency).toBeGreaterThan(0)
      expect(term.frequency).toBeLessThanOrEqual(1)
    }
  })

  it("computes sentence length profile", () => {
    expect(fp.sentenceLength.mean).toBeGreaterThan(0)
    expect(fp.sentenceLength.stdDev).toBeGreaterThanOrEqual(0)
    expect(fp.sentenceLength.min).toBeLessThanOrEqual(fp.sentenceLength.max)
  })

  it("computes fragment ratio between 0 and 1", () => {
    expect(fp.fragmentRatio).toBeGreaterThanOrEqual(0)
    expect(fp.fragmentRatio).toBeLessThanOrEqual(1)
  })

  it("identifies hook types from sample posts", () => {
    expect(fp.topHookTypes.length).toBeGreaterThan(0)
    expect(fp.topHookTypes.length).toBeLessThanOrEqual(3)
  })

  it("computes hook type distribution with valid frequencies", () => {
    const entries = Object.entries(fp.hookTypeDistribution)
    expect(entries.length).toBeGreaterThan(0)
    for (const [, freq] of entries) {
      expect(freq).toBeGreaterThan(0)
      expect(freq).toBeLessThanOrEqual(1)
    }
  })

  it("computes post length profile", () => {
    expect(fp.postLength.mean).toBeGreaterThan(0)
    expect(fp.postLength.min).toBeLessThanOrEqual(fp.postLength.max)
  })

  it("computes tone ratios between 0 and 1", () => {
    for (const ratio of [
      fp.questionRatio,
      fp.exclamationRatio,
      fp.firstPersonRatio,
      fp.secondPersonRatio,
      fp.formalityScore
    ]) {
      expect(ratio).toBeGreaterThanOrEqual(0)
      expect(ratio).toBeLessThanOrEqual(1)
    }
  })

  it("extracts niche keywords up to 20", () => {
    expect(fp.nicheKeywords.length).toBeLessThanOrEqual(20)
    for (const kw of fp.nicheKeywords) {
      expect(kw.count).toBeGreaterThanOrEqual(2)
    }
  })

  it("computes structure metrics", () => {
    expect(fp.lineBreakFrequency.mean).toBeGreaterThanOrEqual(0)
    expect(fp.avgParagraphs).toBeGreaterThan(0)
    expect(fp.usesColons).toBeGreaterThanOrEqual(0)
    expect(fp.usesColons).toBeLessThanOrEqual(1)
    expect(fp.usesLists).toBeGreaterThanOrEqual(0)
    expect(fp.usesLists).toBeLessThanOrEqual(1)
  })

  it("handles minimum 5 posts", () => {
    const small = extractFingerprint(SAMPLE_POSTS.slice(0, 5))
    expect(small.sampleCount).toBe(5)
    expect(small.distinctiveTerms.length).toBeGreaterThan(0)
  })

  it("detects first-person voice", () => {
    // 4/10 posts use "I"/"my" so firstPersonRatio should be notable
    expect(fp.firstPersonRatio).toBeGreaterThanOrEqual(0.3)
  })

  it("detects colon usage", () => {
    // Most posts use colons
    expect(fp.usesColons).toBeGreaterThan(0.3)
  })
})
