import { describe, expect, it } from "vitest"

import { scoreReplyCraft, stripLeadingHandles } from "../src/scoring/reply-craft"

describe("scoreReplyCraft", () => {
  it("scores a mechanism-heavy, multi-sentence reply positively", () => {
    const result = scoreReplyCraft(
      "Good point. In production the bottleneck is usually ownership of the exception path, not model quality."
    )
    expect(result.score).toBeGreaterThan(0)
    expect(result.signals).toContain("multi-sentence")
    expect(result.signals).toContain("mechanism")
  })

  it("scores a praise-only reply negatively", () => {
    const result = scoreReplyCraft("Great point. Everyone over complicates this.")
    expect(result.score).toBeLessThan(0)
    expect(result.antiSignals).toContain("praise-only")
  })

  it("the mechanism/praise-only pair cannot both fail their expected sign", () => {
    const good = scoreReplyCraft(
      "Good point. In production the bottleneck is usually ownership of the exception path, not model quality."
    )
    const bad = scoreReplyCraft("Great point. Everyone over complicates this.")
    expect(good.score).toBeGreaterThan(0)
    expect(bad.score).toBeLessThan(0)
  })

  it("floors at -15 without underflowing when multiple anti-signals stack", () => {
    const result = scoreReplyCraft("love this")
    expect(result.antiSignals).toContain("praise-only")
    expect(result.antiSignals).toContain("near-empty")
    expect(result.score).toBe(-15)
  })

  it("does not flag praise-only when the reply is long enough (60-char ceiling)", () => {
    const result = scoreReplyCraft(
      "Great point. In production the actual bottleneck is usually review-queue ownership drift, not model quality, and most teams never admit the constraint sits there instead of in the model itself."
    )
    expect(result.antiSignals).not.toContain("praise-only")
  })

  it("strips one or more leading handles", () => {
    expect(stripLeadingHandles("@a @b mechanism claim here")).toBe(
      "mechanism claim here"
    )
  })

  describe("adds-vs-echoes", () => {
    const parentText =
      "The database migration caused significant downtime issues today"

    it("scores 0 (no signal) when the reply only restates parent content", () => {
      const result = scoreReplyCraft(
        "That migration caused significant downtime issues",
        { parentText }
      )
      expect(result.signals).not.toContain("adds-not-echoes")
    })

    it("scores +3 when the reply introduces a new number/content", () => {
      const result = scoreReplyCraft(
        "We saw this exact failure three times last month, at 3am",
        { parentText }
      )
      expect(result.signals).toContain("adds-not-echoes")
    })

    it("scores 0 with no anti-signal when parentText is unavailable", () => {
      const result = scoreReplyCraft("Some unrelated reply text here", {
        parentText: null
      })
      expect(result.signals).not.toContain("adds-not-echoes")
      expect(result.antiSignals).toHaveLength(0)
    })
  })

  it("is deterministic across repeated calls", () => {
    const text = "Good point. The real constraint is the review queue, not the model."
    const first = scoreReplyCraft(text)
    const second = scoreReplyCraft(text)
    expect(second).toEqual(first)
  })
})
