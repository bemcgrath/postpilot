import { describe, expect, it } from "vitest"
import { generateRecommendations } from "~learning/recommendations"
import type {
  HookTypePerformance,
  LengthPerformance,
  TimePerformance,
  MediaPerformance,
  TopicPerformance
} from "~learning/types"

describe("generateRecommendations", () => {
  it("generates hook type recommendation for strong boost", () => {
    const hookTypePerf: HookTypePerformance[] = [
      {
        hookType: "data_reveal",
        postCount: 5,
        avgER: 0.04,
        boostMultiplier: 1.8,
        topExamples: []
      }
    ]
    const recs = generateRecommendations({
      hookTypePerf,
      lengthPerf: [],
      timePerf: [],
      mediaPerf: null,
      topicPerf: []
    })
    expect(recs.length).toBe(1)
    expect(recs[0].type).toBe("hook_type")
    expect(recs[0].text).toContain("Data Reveal")
    expect(recs[0].text).toContain("1.8x")
  })

  it("generates length recommendation", () => {
    const lengthPerf: LengthPerformance[] = [
      {
        bucket: "280-320",
        min: 280,
        max: 320,
        postCount: 8,
        avgER: 0.05,
        boostMultiplier: 1.5
      }
    ]
    const recs = generateRecommendations({
      hookTypePerf: [],
      lengthPerf,
      timePerf: [],
      mediaPerf: null,
      topicPerf: []
    })
    expect(recs.some((r) => r.type === "length")).toBe(true)
    expect(recs.find((r) => r.type === "length")!.text).toContain("280-320")
  })

  it("generates time recommendation", () => {
    const timePerf: TimePerformance[] = [
      { hour: 14, postCount: 5, avgER: 0.04, boostMultiplier: 1.8 }
    ]
    const recs = generateRecommendations({
      hookTypePerf: [],
      lengthPerf: [],
      timePerf,
      mediaPerf: null,
      topicPerf: []
    })
    expect(recs.some((r) => r.type === "time")).toBe(true)
    expect(recs.find((r) => r.type === "time")!.text).toContain("2 PM")
  })

  it("generates media recommendation for strong image boost", () => {
    const mediaPerf: MediaPerformance = {
      withImage: { postCount: 5, avgER: 0.06 },
      withoutImage: { postCount: 10, avgER: 0.02 },
      imageBoost: 3.0,
      withLink: { postCount: 3, avgER: 0.01 },
      withoutLink: { postCount: 12, avgER: 0.03 },
      linkBoost: 0.33
    }
    const recs = generateRecommendations({
      hookTypePerf: [],
      lengthPerf: [],
      timePerf: [],
      mediaPerf,
      topicPerf: []
    })
    expect(recs.some((r) => r.type === "media")).toBe(true)
    expect(recs.find((r) => r.type === "media")!.text).toContain("image")
  })

  it("generates topic recommendations", () => {
    const topicPerf: TopicPerformance[] = [
      { keyword: "ai", postCount: 10, avgER: 0.03, boostMultiplier: 1.6 },
      { keyword: "agents", postCount: 5, avgER: 0.025, boostMultiplier: 1.4 }
    ]
    const recs = generateRecommendations({
      hookTypePerf: [],
      lengthPerf: [],
      timePerf: [],
      mediaPerf: null,
      topicPerf
    })
    expect(recs.filter((r) => r.type === "topic")).toHaveLength(2)
  })

  it("skips weak boosts", () => {
    const hookTypePerf: HookTypePerformance[] = [
      {
        hookType: "question",
        postCount: 5,
        avgER: 0.01,
        boostMultiplier: 1.0,
        topExamples: []
      }
    ]
    const recs = generateRecommendations({
      hookTypePerf,
      lengthPerf: [],
      timePerf: [],
      mediaPerf: null,
      topicPerf: []
    })
    expect(recs).toEqual([])
  })

  it("sorts recommendations by boost descending", () => {
    const recs = generateRecommendations({
      hookTypePerf: [
        {
          hookType: "data_reveal",
          postCount: 5,
          avgER: 0.03,
          boostMultiplier: 1.5,
          topExamples: []
        }
      ],
      lengthPerf: [],
      timePerf: [
        { hour: 14, postCount: 5, avgER: 0.05, boostMultiplier: 2.0 }
      ],
      mediaPerf: null,
      topicPerf: []
    })
    expect(recs[0].boostMultiplier).toBeGreaterThanOrEqual(
      recs[recs.length - 1].boostMultiplier
    )
  })
})
