import { describe, expect, it } from "vitest"

import { buildDefaults } from "../src/config/defaults"

describe("buildDefaults", () => {
  const config = buildDefaults()

  it("returns schemaVersion 1", () => {
    expect(config.schemaVersion).toBe(1)
  })

  describe("governor", () => {
    it("has 29 banned phrases", () => {
      expect(config.governor.bannedPhrases).toHaveLength(29)
    })

    it("has 37 weak phrases", () => {
      expect(config.governor.weakPhrases).toHaveLength(37)
    })

    it("has 5 fabrication patterns", () => {
      expect(config.governor.fabricationPatterns).toHaveLength(5)
    })

    it("has 2 fabricated stats patterns", () => {
      expect(config.governor.fabricatedStatsPatterns).toHaveLength(2)
    })

    it("all phrases are enabled by default", () => {
      const allPhrases = [
        ...config.governor.bannedPhrases,
        ...config.governor.weakPhrases,
        ...config.governor.fabricationPatterns,
        ...config.governor.fabricatedStatsPatterns
      ]
      expect(allPhrases.every((p) => p.enabled)).toBe(true)
    })

    it("no phrases are custom", () => {
      const allPhrases = [
        ...config.governor.bannedPhrases,
        ...config.governor.weakPhrases,
        ...config.governor.fabricationPatterns,
        ...config.governor.fabricatedStatsPatterns
      ]
      expect(allPhrases.every((p) => !p.isCustom)).toBe(true)
    })

    it("all phrases have unique IDs", () => {
      const allPhrases = [
        ...config.governor.bannedPhrases,
        ...config.governor.weakPhrases,
        ...config.governor.fabricationPatterns,
        ...config.governor.fabricatedStatsPatterns
      ]
      const ids = allPhrases.map((p) => p.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it("all phrase patterns are valid regex", () => {
      const allPhrases = [
        ...config.governor.bannedPhrases,
        ...config.governor.weakPhrases,
        ...config.governor.fabricationPatterns,
        ...config.governor.fabricatedStatsPatterns
      ]
      for (const phrase of allPhrases) {
        expect(() => new RegExp(phrase.pattern, "i")).not.toThrow()
      }
    })

    it("has correct length thresholds", () => {
      expect(config.governor.lengthErrorThreshold).toBe(500)
      expect(config.governor.lengthWarningThreshold).toBe(350)
    })

    it("has emoji warning enabled", () => {
      expect(config.governor.emojiWarningEnabled).toBe(true)
    })
  })

  describe("hookAnalyzer", () => {
    it("has base score 50", () => {
      expect(config.hookAnalyzer.baseScore).toBe(50)
    })

    it("has hookTypeBonusMax 15", () => {
      expect(config.hookAnalyzer.hookTypeBonusMax).toBe(15)
    })

    it("has correct specificity values", () => {
      expect(config.hookAnalyzer.specificity.numbers).toBe(8)
      expect(config.hookAnalyzer.specificity.timeframe).toBe(6)
      expect(config.hookAnalyzer.specificity.entity).toBe(6)
    })

    it("has correct length ranges", () => {
      expect(config.hookAnalyzer.length.optimalMin).toBe(40)
      expect(config.hookAnalyzer.length.optimalMax).toBe(100)
      expect(config.hookAnalyzer.length.acceptableMin).toBe(30)
      expect(config.hookAnalyzer.length.acceptableMax).toBe(120)
      expect(config.hookAnalyzer.length.optimalScore).toBe(10)
      expect(config.hookAnalyzer.length.acceptableScore).toBe(5)
    })

    it("has correct curiosity gap bonuses", () => {
      expect(config.hookAnalyzer.curiosityGap.openLoopBonus).toBe(10)
      expect(config.hookAnalyzer.curiosityGap.tensionWordBonus).toBe(5)
    })

    it("has correct penalties (all negative)", () => {
      expect(config.hookAnalyzer.penalties.genericOpener).toBe(-10)
      expect(config.hookAnalyzer.penalties.blandStart).toBe(-15)
      expect(config.hookAnalyzer.penalties.tooLongHook).toBe(-5)
      expect(config.hookAnalyzer.penalties.questionNoNumbers).toBe(-5)
    })

    it("has hookMaxLength 120", () => {
      expect(config.hookAnalyzer.hookMaxLength).toBe(120)
    })

    it("has weakThreshold 60", () => {
      expect(config.hookAnalyzer.weakThreshold).toBe(60)
    })
  })

  describe("hookTypes", () => {
    it("has empty overrides by default", () => {
      expect(config.hookTypes.overrides).toEqual({})
    })
  })

  describe("pipeline", () => {
    it("has sweet spot 280-320", () => {
      expect(config.pipeline.sweetSpotMin).toBe(280)
      expect(config.pipeline.sweetSpotMax).toBe(320)
    })
  })
})
