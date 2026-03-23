import { describe, expect, it } from "vitest"

import { HookAnalyzer } from "../src/scoring/hook-analyzer"

const analyzer = new HookAnalyzer()

describe("HookAnalyzer.extractHook", () => {
  it("returns empty string for empty input", () => {
    expect(analyzer.extractHook("")).toBe("")
  })

  it("extracts first line when short enough", () => {
    const text = "First line here.\nSecond line with more detail."
    expect(analyzer.extractHook(text)).toBe("First line here.")
  })

  it("extracts first sentence when first line is too long", () => {
    const longLine =
      "This is the first sentence. And then a much longer second sentence that goes well beyond 120 characters and keeps going and going and going until very long indeed."
    const result = analyzer.extractHook(longLine)
    expect(result).toBe("This is the first sentence.")
  })

  it("handles multiline text", () => {
    const text = "Short hook here\n\nLonger body text follows."
    expect(analyzer.extractHook(text)).toBe("Short hook here")
  })
})

describe("HookAnalyzer.score", () => {
  it("returns 0 for empty text", () => {
    const result = analyzer.score("")
    expect(result.totalScore).toBe(0)
    expect(result.isWeak).toBe(true)
  })

  it("scores strong hooks >= 60", () => {
    const strongHooks = [
      "I tracked 50 AI agents for 90 days. Here's what the data showed:",
      "Everything you've read about RAG is wrong. Here's what actually works:",
      "87% of AI projects fail. Here's the pattern:"
    ]
    for (const hook of strongHooks) {
      const result = analyzer.score(hook)
      expect(result.totalScore).toBeGreaterThanOrEqual(60)
      expect(result.isWeak).toBe(false)
    }
  })

  it("scores weak hooks < 60", () => {
    const weakHooks = [
      "Thread: Some thoughts on AI",
      "I think AI is interesting",
      "Just wanted to share something"
    ]
    for (const hook of weakHooks) {
      const result = analyzer.score(hook)
      expect(result.totalScore).toBeLessThan(60)
      expect(result.isWeak).toBe(true)
    }
  })

  it("detects hook type", () => {
    const result = analyzer.score(
      "I tracked 50 AI agents for 90 days. Here's what the data showed:"
    )
    expect(result.hookType).toBe("data_reveal")
  })

  it("provides breakdown with all components", () => {
    const result = analyzer.score("Some test hook about AI in 2025.")
    const b = result.breakdown
    expect(b.base).toBe(50)
    expect(b.hookType).toBeGreaterThanOrEqual(0)
    expect(b.specificity).toBeGreaterThanOrEqual(0)
    expect(b.length).toBeGreaterThanOrEqual(0)
    expect(b.curiosityGap).toBeGreaterThanOrEqual(0)
    expect(b.patternMatch).toBe(0) // stub
  })

  it("generates suggestions for weak hooks", () => {
    const result = analyzer.score("Hi")
    expect(result.suggestions.length).toBeGreaterThan(0)
  })

  it("limits suggestions to 5", () => {
    const result = analyzer.score("just a vague thought?")
    expect(result.suggestions.length).toBeLessThanOrEqual(5)
  })

  it("gives specificity bonus for numbers", () => {
    const withNum = analyzer.score("87% of AI projects fail.")
    const noNum = analyzer.score("Many AI projects fail.")
    expect(withNum.breakdown.specificity).toBeGreaterThan(
      noNum.breakdown.specificity
    )
  })

  it("gives length bonus for optimal hook length", () => {
    // 40-100 chars = 10 points
    const optimal = analyzer.score(
      "This is an optimally-sized hook for testing the length scorer."
    )
    expect(optimal.breakdown.length).toBe(10)
  })

  it("gives partial length bonus for acceptable hook length", () => {
    // 30-39 chars or 101-120 chars = 5 points
    const shortAcceptable = analyzer.score("Here is a medium-length hook!!")
    expect(shortAcceptable.breakdown.length).toBe(5)
  })

  it("gives no length bonus for very long hooks", () => {
    const tooLong = analyzer.score(
      "This is an extremely long hook that goes well beyond 120 characters and should not receive any length bonus at all because it exceeds the maximum"
    )
    expect(tooLong.breakdown.length).toBe(0)
  })

  it("penalizes generic openers", () => {
    const generic = analyzer.score("Thread: some thoughts on AI trends")
    expect(generic.breakdown.penalties).toBeLessThan(0)
  })

  it("penalizes bland starts", () => {
    const bland = analyzer.score("I think this is a good technology.")
    expect(bland.breakdown.penalties).toBeLessThan(0)
  })

  it("score is always 0-100", () => {
    const hooks = [
      "",
      "x",
      "I tracked 100 agents for 365 days. Here's what I discovered:",
      "Thread: I think this is just some thoughts on AI. Thoughts?"
    ]
    for (const hook of hooks) {
      const result = analyzer.score(hook)
      expect(result.totalScore).toBeGreaterThanOrEqual(0)
      expect(result.totalScore).toBeLessThanOrEqual(100)
    }
  })
})
