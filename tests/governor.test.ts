import { describe, expect, it } from "vitest"

import { checkGovernor } from "../src/scoring/governor"

describe("checkGovernor", () => {
  it("returns clean result for good text", () => {
    const result = checkGovernor(
      "Brain data access is the binding constraint in neuroscience.\n\nThe real bottleneck isn't compute. It's getting clean, labeled neural recordings at scale."
    )
    expect(result.hasBannedPhrases).toBe(false)
    expect(result.hasWeakPhrases).toBe(false)
    expect(result.hasLengthWarning).toBe(false)
    expect(result.hasEmoji).toBe(false)
  })

  describe("banned phrases", () => {
    const bannedExamples = [
      ["game-changer", "game-changer"],
      ["What do you think?", "What do you think"],
      ["This leverages the power of AI", "leverages"],
      ["Let's delve into this topic", "delve"],
      ["Follow for more insights", "Follow for more"],
      ["This unlocks new possibilities", "unlocks"],
      ["thoughts?", "thoughts?"],
      ["You should try this", "You should"],
      ["I've tested this approach", "I've tested"]
    ]

    for (const [input, fragment] of bannedExamples) {
      it(`catches "${fragment}"`, () => {
        const result = checkGovernor(input)
        expect(result.hasBannedPhrases).toBe(true)
        const errorIssues = result.issues.filter(
          (i) => i.severity === "error"
        )
        expect(errorIssues.length).toBeGreaterThan(0)
      })
    }

    it("catches em-dashes (word—word)", () => {
      const result = checkGovernor(
        "AI isn't just coming—it's already here."
      )
      expect(result.hasBannedPhrases).toBe(true)
    })

    it("catches percentage confident", () => {
      const result = checkGovernor("I'm 90% confident this will work.")
      expect(result.hasBannedPhrases).toBe(true)
    })
  })

  describe("weak phrases", () => {
    const weakExamples = [
      "This could have implications for the industry.",
      "Has the potential to transform everything.",
      "The trend is clear in the data.",
      "This highlights the importance of testing.",
      "Developers should pay attention to this.",
      "The bottom line: it works.",
      "Share your thoughts below."
    ]

    for (const input of weakExamples) {
      it(`flags "${input.slice(0, 40)}..."`, () => {
        const result = checkGovernor(input)
        expect(result.hasWeakPhrases).toBe(true)
        const warnings = result.issues.filter(
          (i) =>
            i.severity === "warning" &&
            i.message.includes("Weak/generic")
        )
        expect(warnings.length).toBeGreaterThan(0)
      })
    }
  })

  describe("fabrication patterns", () => {
    it("warns on personal tracking claims", () => {
      const result = checkGovernor(
        "I tracked my sleep quality for 30 days and the results were clear."
      )
      const fabricationWarnings = result.issues.filter(
        (i) =>
          i.severity === "warning" &&
          i.message.includes("fabrication")
      )
      expect(fabricationWarnings.length).toBeGreaterThan(0)
    })

    it("blocks fabricated percentage stats", () => {
      const result = checkGovernor(
        "This led to a 47% reduction in processing time."
      )
      expect(result.hasBannedPhrases).toBe(true)
    })
  })

  describe("length checks", () => {
    it("no warning for normal length", () => {
      const result = checkGovernor("A".repeat(300))
      expect(result.hasLengthWarning).toBe(false)
    })

    it("warns for over 350 chars", () => {
      const result = checkGovernor("A".repeat(360))
      expect(result.hasLengthWarning).toBe(true)
      expect(
        result.issues.some((i) => i.severity === "warning")
      ).toBe(true)
    })

    it("errors for over 500 chars", () => {
      const result = checkGovernor("A".repeat(510))
      expect(result.hasLengthWarning).toBe(true)
      expect(
        result.issues.some((i) => i.severity === "error")
      ).toBe(true)
    })
  })

  describe("emoji detection", () => {
    it("detects emoji", () => {
      const result = checkGovernor("Great post! 🚀🔥")
      expect(result.hasEmoji).toBe(true)
    })

    it("passes without emoji", () => {
      const result = checkGovernor("Great post with no special chars.")
      expect(result.hasEmoji).toBe(false)
    })
  })

  it("accumulates multiple issues", () => {
    const result = checkGovernor(
      "This is a game-changer! 🚀 Thoughts? This highlights the growing importance of leveraging AI. " +
        "A".repeat(400)
    )
    expect(result.issues.length).toBeGreaterThan(3)
    expect(result.hasBannedPhrases).toBe(true)
    expect(result.hasWeakPhrases).toBe(true)
    expect(result.hasEmoji).toBe(true)
    expect(result.hasLengthWarning).toBe(true)
  })
})
