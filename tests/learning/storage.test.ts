import { describe, expect, it } from "vitest"
import { normalizeInsights } from "~learning/storage"

describe("normalizeInsights", () => {
  it("fills every field with a safe default when given an empty object", () => {
    const result = normalizeInsights({})
    expect(result.hookTypePerformance).toEqual([])
    expect(result.lengthPerformance).toEqual([])
    expect(result.topicPerformance).toEqual([])
    expect(result.timePerformance).toEqual([])
    expect(result.weekdayTimePerformance).toEqual([])
    expect(result.weekendTimePerformance).toEqual([])
    expect(result.recommendations).toEqual([])
    expect(result.hookTypeBoosts).toEqual({})
    expect(result.mediaPerformance).toBeNull()
    expect(result.optimalLengthRange).toBeNull()
    expect(result.isReady).toBe(false)
    expect(result.postsAnalyzed).toBe(0)
    expect(result.baselineEngagementRate).toBe(0)
    expect(result.generatedAt).toBe(0)
    expect(result.insightsVersion).toBe(1)
    expect(result.segmentation).toBe("blended")
    expect(result.originalsAnalyzed).toBe(0)
    expect(result.repliesAnalyzed).toBe(0)
    expect(result.unknownSegmentCount).toBe(0)
    expect(result.replyInsights).toBeNull()
  })

  it("simulates a payload cached before the reply-craft split shipped", () => {
    // Mirrors a real stored object from before insightsVersion/segmentation/
    // replyInsights existed -- normalizeInsights must describe it truthfully
    // as version 1 / blended, not silently claim it was ever segmented.
    const staleFromDisk = {
      generatedAt: 456,
      postsAnalyzed: 22,
      baselineEngagementRate: 0.03,
      isReady: true,
      hookTypePerformance: [],
      lengthPerformance: [],
      topicPerformance: [],
      timePerformance: [],
      weekdayTimePerformance: [],
      weekendTimePerformance: [],
      mediaPerformance: null,
      recommendations: [],
      hookTypeBoosts: {},
      optimalLengthRange: null
      // insightsVersion / segmentation / originalsAnalyzed / repliesAnalyzed /
      // unknownSegmentCount / replyInsights intentionally absent
    } as unknown as Partial<import("~learning/types").LearnedInsights>

    const result = normalizeInsights(staleFromDisk)
    expect(result.insightsVersion).toBe(1)
    expect(result.segmentation).toBe("blended")
    expect(result.replyInsights).toBeNull()
    expect(result.postsAnalyzed).toBe(22)
  })

  it("simulates the exact bug: data cached before weekday/weekend fields existed", () => {
    // Mirrors a real object shape from before today's weekday/weekend split
    // was added -- these two fields are simply absent, not empty arrays.
    const staleFromDisk = {
      generatedAt: 123,
      postsAnalyzed: 25,
      baselineEngagementRate: 0.02,
      isReady: true,
      hookTypePerformance: [],
      lengthPerformance: [],
      topicPerformance: [],
      timePerformance: [{ hour: 7, postCount: 3, avgER: 0.03, boostMultiplier: 1.5 }],
      mediaPerformance: null,
      recommendations: [],
      hookTypeBoosts: {},
      optimalLengthRange: null
      // weekdayTimePerformance / weekendTimePerformance intentionally absent
    } as unknown as Partial<import("~learning/types").LearnedInsights>

    const result = normalizeInsights(staleFromDisk)
    // Would have been undefined before the fix -- .length on this crashed the UI.
    expect(result.weekdayTimePerformance).toEqual([])
    expect(result.weekendTimePerformance).toEqual([])
    expect(() => result.weekdayTimePerformance.length).not.toThrow()
    // Real prior data is preserved, not clobbered by defaults.
    expect(result.timePerformance).toHaveLength(1)
    expect(result.postsAnalyzed).toBe(25)
  })

  it("preserves a fully-populated object unchanged", () => {
    const full = {
      insightsVersion: 2,
      segmentation: "segmented" as const,
      originalsAnalyzed: 18,
      repliesAnalyzed: 10,
      unknownSegmentCount: 2,
      replyInsights: null,
      generatedAt: 1000,
      postsAnalyzed: 30,
      baselineEngagementRate: 0.05,
      isReady: true,
      hookTypePerformance: [{ hookType: "data_reveal" as const, postCount: 5, avgER: 0.06, boostMultiplier: 1.2, topExamples: [] }],
      lengthPerformance: [],
      topicPerformance: [],
      timePerformance: [],
      weekdayTimePerformance: [{ hour: 9, postCount: 4, avgER: 0.07, boostMultiplier: 1.4 }],
      weekendTimePerformance: [],
      mediaPerformance: null,
      recommendations: [],
      hookTypeBoosts: { data_reveal: 1.2 },
      optimalLengthRange: { min: 200, max: 300 }
    }
    const result = normalizeInsights(full)
    expect(result).toEqual(full)
  })
})
