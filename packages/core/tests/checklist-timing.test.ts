import { describe, expect, it } from "vitest"
import { buildPrePublishChecklist } from "~scoring/checklist"
import { evaluatePostingTime } from "~scoring/timing"
import { suggestSelfReply } from "~scoring/self-reply"

describe("buildPrePublishChecklist", () => {
  it("marks hook, governor, and length", () => {
    const items = buildPrePublishChecklist({
      hookScore: 72,
      governorErrors: 0,
      inSweetSpot: true,
      hasImage: false,
      hasLink: false,
      mediaDelta: 0,
      nowGood: true
    })
    expect(items.map((i) => i.id)).toEqual(["hook", "governor", "length", "time"])
    expect(items.every((i) => i.ok)).toBe(true)
  })

  it("fails governor errors and notes attached media", () => {
    const items = buildPrePublishChecklist({
      hookScore: 40,
      governorErrors: 2,
      inSweetSpot: false,
      hasImage: true,
      hasLink: false,
      mediaDelta: 4,
      nowGood: null
    })
    expect(items.find((i) => i.id === "hook")!.ok).toBe(false)
    expect(items.find((i) => i.id === "governor")!.ok).toBe(false)
    expect(items.find((i) => i.id === "media")!.label).toMatch(/image/)
    expect(items.find((i) => i.id === "time")).toBeUndefined()
  })
})

describe("evaluatePostingTime", () => {
  const insights = {
    timePerformance: [{ hour: 9, postCount: 5, boostMultiplier: 1.4 }],
    weekdayTimePerformance: [{ hour: 9, postCount: 5, boostMultiplier: 1.4 }],
    weekendTimePerformance: []
  }

  it("says now is good when the current hour is a learned peak", () => {
    // Wednesday 9 AM
    const now = new Date("2026-08-12T09:00:00")
    const verdict = evaluatePostingTime(insights, now)
    expect(verdict?.nowGood).toBe(true)
    expect(verdict?.label).toBe("Now's a good time")
  })

  it("points at the better window otherwise", () => {
    const now = new Date("2026-08-12T15:00:00")
    const verdict = evaluatePostingTime(insights, now)
    expect(verdict?.nowGood).toBe(false)
    expect(verdict?.label).toMatch(/Better at/)
  })
})

describe("suggestSelfReply", () => {
  it("skips replies and short posts", () => {
    expect(suggestSelfReply("A claim about RAG.", "contrarian", "reply")).toBeNull()
    expect(suggestSelfReply("Too short", "contrarian", "original")).toBeNull()
  })

  it("offers a caveat after a data reveal", () => {
    const text = "I tracked 50 agents for 90 days and most failed silently."
    expect(suggestSelfReply(text, "data_reveal", "original")).toMatch(/Caveat/)
  })
})
