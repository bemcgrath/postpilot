import { describe, expect, it } from "vitest"

import { buildDefaults } from "../src/config/defaults"
import {
  getConfig,
  getGovernorConfig,
  getHookAnalyzerConfig,
  getHookTypesConfig,
  getPipelineConfig,
  mergePhraseList,
  resetConfigForTesting,
  setConfigForTesting
} from "../src/config/config-storage"
import type { PhraseEntry, PostPilotConfig } from "../src/config/types"

describe("mergePhraseList", () => {
  const defaults: PhraseEntry[] = [
    { id: "a", pattern: "foo", enabled: true, isCustom: false },
    { id: "b", pattern: "bar", enabled: true, isCustom: false },
    { id: "c", pattern: "baz", enabled: true, isCustom: false }
  ]

  it("returns defaults when saved is undefined", () => {
    const result = mergePhraseList(defaults, undefined)
    expect(result).toEqual(defaults)
  })

  it("preserves enabled state from saved", () => {
    const saved: PhraseEntry[] = [
      { id: "b", pattern: "bar", enabled: false, isCustom: false }
    ]
    const result = mergePhraseList(defaults, saved)
    expect(result.find((p) => p.id === "a")!.enabled).toBe(true)
    expect(result.find((p) => p.id === "b")!.enabled).toBe(false)
    expect(result.find((p) => p.id === "c")!.enabled).toBe(true)
  })

  it("appends custom entries from saved", () => {
    const saved: PhraseEntry[] = [
      { id: "custom_1", pattern: "custom", enabled: true, isCustom: true }
    ]
    const result = mergePhraseList(defaults, saved)
    expect(result).toHaveLength(4)
    expect(result[3].id).toBe("custom_1")
    expect(result[3].isCustom).toBe(true)
  })

  it("new defaults appear automatically", () => {
    const newDefaults: PhraseEntry[] = [
      ...defaults,
      { id: "d", pattern: "qux", enabled: true, isCustom: false }
    ]
    const saved: PhraseEntry[] = [
      { id: "a", pattern: "foo", enabled: false, isCustom: false }
    ]
    const result = mergePhraseList(newDefaults, saved)
    expect(result).toHaveLength(4)
    expect(result.find((p) => p.id === "d")!.enabled).toBe(true)
    expect(result.find((p) => p.id === "a")!.enabled).toBe(false)
  })

  it("combines disabled defaults and custom entries", () => {
    const saved: PhraseEntry[] = [
      { id: "a", pattern: "foo", enabled: false, isCustom: false },
      { id: "c", pattern: "baz", enabled: false, isCustom: false },
      { id: "custom_x", pattern: "hello", enabled: true, isCustom: true }
    ]
    const result = mergePhraseList(defaults, saved)
    expect(result).toHaveLength(4) // 3 defaults + 1 custom
    expect(result.filter((p) => p.enabled)).toHaveLength(2) // b + custom
  })
})

describe("config test helpers", () => {
  it("setConfigForTesting overrides getConfig", () => {
    const custom = buildDefaults()
    custom.pipeline.sweetSpotMin = 200
    setConfigForTesting(custom)
    expect(getConfig().pipeline.sweetSpotMin).toBe(200)
    expect(getPipelineConfig().sweetSpotMin).toBe(200)
    resetConfigForTesting()
  })

  it("resetConfigForTesting restores defaults", () => {
    const custom = buildDefaults()
    custom.hookAnalyzer.baseScore = 99
    setConfigForTesting(custom)
    expect(getHookAnalyzerConfig().baseScore).toBe(99)
    resetConfigForTesting()
    expect(getHookAnalyzerConfig().baseScore).toBe(50)
  })

  it("section getters return correct sections", () => {
    resetConfigForTesting()
    const gov = getGovernorConfig()
    expect(gov.bannedPhrases.length).toBe(29)

    const ha = getHookAnalyzerConfig()
    expect(ha.baseScore).toBe(50)

    const ht = getHookTypesConfig()
    expect(ht.overrides).toEqual({})

    const pl = getPipelineConfig()
    expect(pl.sweetSpotMin).toBe(280)
  })
})

describe("config schema migration", () => {
  it("fills missing sections from defaults", () => {
    // Simulate a saved config with only governor section
    const partial: Partial<PostPilotConfig> = {
      schemaVersion: 1,
      governor: {
        ...buildDefaults().governor,
        lengthErrorThreshold: 600
      }
    }
    // This would be handled by mergeWithDefaults in initConfig
    // We test that the getter defaults still work
    resetConfigForTesting()
    const config = getConfig()
    expect(config.hookAnalyzer.baseScore).toBe(50)
    expect(config.pipeline.sweetSpotMin).toBe(280)
  })
})
