import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { scorePost } from "../src/scoring/scoring-pipeline"
import { resetConfigForTesting } from "../src/config/config-storage"
import { extractFingerprint } from "../src/scoring/voice-fingerprint"

beforeEach(() => {
  resetConfigForTesting()
})

afterEach(() => {
  resetConfigForTesting()
})

// Same corpus as voice-match.test.ts, all originals -- the fingerprint's
// postLength average reflects these, never a reply.
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

describe("scorePost reply-aware scoring", () => {
  it("applies the originals band for kind: original and the reply band for kind: reply, on the same text", () => {
    const text = "A".repeat(100)

    const asOriginal = scorePost(text, null, undefined, null, { kind: "original" })
    const asReply = scorePost(text, null, undefined, null, { kind: "reply" })

    expect(asOriginal.inSweetSpot).toBe(false) // 100 chars is outside 280-320
    expect(asReply.inSweetSpot).toBe(true) // 100 chars is inside the 60-160 reply default
  })

  it("prefers a learned optimalLengthRange over the configured reply defaults", () => {
    const text = "A".repeat(100)
    const result = scorePost(text, null, undefined, null, {
      kind: "reply",
      replyInsights: { optimalLengthRange: { min: 90, max: 95 } }
    })

    expect(result.sweetSpotRange).toEqual({ min: 90, max: 95 })
    expect(result.inSweetSpot).toBe(false) // 100 is outside the learned 90-95 band
  })

  it("scores kind: unknown identically to kind omitted, aside from the diagnostic kind label itself", () => {
    const text = "I tracked 50 AI agents for 90 days. Here's what the data showed:"
    const withUnknown = scorePost(text, null, undefined, null, { kind: "unknown" })
    const withoutContext = scorePost(text, null, undefined, null)

    const { kind: unknownKind, ...unknownRest } = withUnknown
    const { kind: defaultKind, ...defaultRest } = withoutContext
    expect(unknownRest).toEqual(defaultRest)
    expect(unknownKind).toBe("unknown")
    expect(defaultKind).toBe("original")
  })

  it("suppresses questionNoNumbers for a reply but not for the same text as an original", () => {
    const text = "Why does this keep breaking in production?"
    const asOriginal = scorePost(text, null, undefined, null, { kind: "original" })
    const asReply = scorePost(text, null, undefined, null, { kind: "reply" })

    expect(asOriginal.hookScore.breakdown.penaltyReasons.join(" ")).toMatch(
      /Question without numbers/
    )
    expect(asReply.hookScore.breakdown.penaltyReasons.join(" ")).not.toMatch(
      /Question without numbers/
    )
  })

  it("reports the sweetSpotRange actually applied", () => {
    const asOriginal = scorePost("hello", null, undefined, null, {
      kind: "original"
    })
    expect(asOriginal.sweetSpotRange).toEqual({ min: 280, max: 320 })

    const asReply = scorePost("hello", null, undefined, null, { kind: "reply" })
    expect(asReply.sweetSpotRange).toEqual({ min: 60, max: 160 })
  })

  it("suppresses voiceMatch for replies even when a real fingerprint is provided", () => {
    // Regression: a real reply (~110 chars) live-scored 0/100 on the
    // fingerprint's Length dimension, which reflects the user's *originals*
    // average (~300 chars) -- a wrong comparison, not a low score.
    const shortReply = "Why does this keep breaking in production?"

    const asOriginal = scorePost(shortReply, fp, undefined, null, {
      kind: "original"
    })
    const asReply = scorePost(shortReply, fp, undefined, null, {
      kind: "reply"
    })

    expect(asOriginal.voiceMatch).not.toBeNull()
    expect(asReply.voiceMatch).toBeNull()
  })

  it("is backward compatible: omitting the 5th argument matches pre-change behavior", () => {
    const text = "I tracked 50 AI agents for 90 days. Here's what the data showed:"
    const result = scorePost(text, null, undefined, null)

    expect(result.kind).toBe("original")
    expect(result.hookScore.totalScore).toBe(90)
    expect(result.inSweetSpot).toBe(false)
  })
})
