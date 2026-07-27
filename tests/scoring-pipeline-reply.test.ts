import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { scorePost } from "../src/scoring/scoring-pipeline"
import { resetConfigForTesting } from "../src/config/config-storage"

beforeEach(() => {
  resetConfigForTesting()
})

afterEach(() => {
  resetConfigForTesting()
})

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

  it("is backward compatible: omitting the 5th argument matches pre-change behavior", () => {
    const text = "I tracked 50 AI agents for 90 days. Here's what the data showed:"
    const result = scorePost(text, null, undefined, null)

    expect(result.kind).toBe("original")
    expect(result.hookScore.totalScore).toBe(90)
    expect(result.inSweetSpot).toBe(false)
  })
})
