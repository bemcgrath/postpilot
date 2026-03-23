import { describe, expect, it } from "vitest"

import {
  HOOK_TYPES,
  classifyHookType,
  getAllHookTypes,
  getHookDescription,
  getHookExamples,
  getHookTypeWeight,
  humanizeHookType
} from "../src/scoring/hook-types"

describe("HOOK_TYPES", () => {
  it("has 20 hook types", () => {
    expect(Object.keys(HOOK_TYPES)).toHaveLength(20)
  })

  it("each type has required fields", () => {
    for (const [name, type] of Object.entries(HOOK_TYPES)) {
      expect(type.name).toBe(name)
      expect(type.description.length).toBeGreaterThan(0)
      expect(type.patterns.length).toBeGreaterThan(0)
      expect(type.baseWeight).toBeGreaterThanOrEqual(1.0)
      expect(type.examples.length).toBeGreaterThan(0)
    }
  })
})

describe("classifyHookType", () => {
  it("returns null for empty text", () => {
    const [type, confidence] = classifyHookType("")
    expect(type).toBeNull()
    expect(confidence).toBe(0.0)
  })

  it("classifies data_reveal hooks", () => {
    const [type] = classifyHookType(
      "I tracked 50 AI agents for 90 days. Here's what the data showed:"
    )
    expect(type).toBe("data_reveal")
  })

  it("classifies contrarian hooks", () => {
    const [type] = classifyHookType(
      "Everything you've read about RAG is wrong."
    )
    expect(type).toBe("contrarian")
  })

  it("classifies curiosity_gap hooks", () => {
    const [type] = classifyHookType(
      "Here's why your AI agent keeps failing at simple tasks:"
    )
    expect(type).toBe("curiosity_gap")
  })

  it("classifies personal_failure hooks", () => {
    const [type] = classifyHookType(
      "I was wrong about longevity supplements."
    )
    expect(type).toBe("personal_failure")
  })

  it("classifies question hooks", () => {
    const [type] = classifyHookType(
      "Why do 90% of AI agents fail in production?"
    )
    expect(type).toBe("question")
  })

  it("classifies shocking_stat hooks", () => {
    const [type] = classifyHookType(
      "NVIDIA's GPUs handle 95% of the world's AI training compute today."
    )
    expect(type).toBe("shocking_stat")
  })

  it("classifies direct_challenge hooks", () => {
    const [type] = classifyHookType(
      "You're prompting AI like it's Google. That's why your outputs sound generic."
    )
    expect(type).toBe("direct_challenge")
  })

  it("classifies binary_frame hooks", () => {
    const [type] = classifyHookType(
      "You're either building with AI agents or you're building against them."
    )
    expect(type).toBe("binary_frame")
  })

  it("classifies reader_mirror hooks", () => {
    const [type] = classifyHookType(
      "If you're a CTO who just got asked about AI strategy by your board"
    )
    expect(type).toBe("reader_mirror")
  })

  it("deprioritizes amplification when a more specific type matches", () => {
    const [type] = classifyHookType(
      "@Rainmaker1973 2M people just saw a 10-second clip of North Sentinel Island."
    )
    // Should match shocking_stat, not amplification
    expect(type).not.toBe("amplification")
  })

  it("falls back to amplification for generic @replies", () => {
    const [type] = classifyHookType("@someone Nice post about this topic")
    expect(type).toBe("amplification")
  })

  it("each type matches at least one of its own examples", () => {
    for (const [name, hookType] of Object.entries(HOOK_TYPES)) {
      const matchedAny = hookType.examples.some(
        (ex) => classifyHookType(ex)[0] === name
      )
      // amplification examples are intentionally overridden by more specific types
      if (name === "amplification") continue
      expect(matchedAny).toBe(true)
    }
  })
})

describe("helper functions", () => {
  it("getHookTypeWeight returns correct weight", () => {
    expect(getHookTypeWeight("contrarian")).toBe(1.35)
    expect(getHookTypeWeight("question")).toBe(1.0)
    expect(getHookTypeWeight("nonexistent")).toBe(1.0)
  })

  it("getHookExamples returns examples", () => {
    const examples = getHookExamples("data_reveal")
    expect(examples.length).toBeGreaterThan(0)
    expect(examples.length).toBeLessThanOrEqual(3)
  })

  it("getAllHookTypes returns 20 types", () => {
    expect(getAllHookTypes()).toHaveLength(20)
  })

  it("getHookDescription returns description", () => {
    expect(getHookDescription("contrarian")).toContain("Challenge")
    expect(getHookDescription("nonexistent")).toBe("")
  })

  it("humanizeHookType formats names", () => {
    expect(humanizeHookType("data_reveal")).toBe("Data Reveal")
    expect(humanizeHookType("curiosity_gap")).toBe("Curiosity Gap")
    expect(humanizeHookType("binary_frame")).toBe("Binary Frame")
  })
})
