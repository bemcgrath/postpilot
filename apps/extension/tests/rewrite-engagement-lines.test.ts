import { describe, expect, it } from "vitest"
import { formatEngagementLines } from "../src/rewrite/rewrite-service"

describe("formatEngagementLines", () => {
  it("lists lean-in and avoid hook types, omits neutrals", () => {
    const text = formatEngagementLines({
      contrarian: 1.4,
      data_reveal: 1.0,
      question: 0.7
    })
    expect(text).toBe("Lean in: Contrarian (1.40x)\nAvoid: Question (0.70x)")
  })

  it("returns undefined when every multiplier is neutral", () => {
    expect(formatEngagementLines({ declarative_claim: 1.0, curiosity_gap: 1.1 })).toBeUndefined()
  })

  it("returns undefined when boosts are missing", () => {
    expect(formatEngagementLines(undefined)).toBeUndefined()
  })
})
