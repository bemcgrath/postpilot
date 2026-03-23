import type {
  GovernorConfig,
  HookAnalyzerConfig,
  HookTypesConfig,
  PipelineConfig,
  PostPilotConfig
} from "./types"

import { buildDefaults } from "./defaults"

const STORAGE_KEY = "postpilot_config"

/** In-memory config cache. */
let currentConfig: PostPilotConfig = buildDefaults()

/** Listeners for config changes. */
const changeListeners: Array<(config: PostPilotConfig) => void> = []

/** Safely access chrome.storage.local — returns null if unavailable or context invalidated. */
function getStorage(): typeof chrome.storage.local | null {
  try {
    if (
      typeof chrome !== "undefined" &&
      chrome.runtime?.id &&
      typeof chrome.storage !== "undefined" &&
      typeof chrome.storage.local !== "undefined"
    ) {
      return chrome.storage.local
    }
  } catch {
    // Extension context invalidated or not available
  }
  return null
}

/** Deep merge saved config over defaults so new defaults appear on update. */
function mergeWithDefaults(
  saved: Partial<PostPilotConfig>
): PostPilotConfig {
  const defaults = buildDefaults()

  const governor: GovernorConfig = {
    ...defaults.governor,
    ...(saved.governor ?? {}),
    bannedPhrases: mergePhraseList(
      defaults.governor.bannedPhrases,
      saved.governor?.bannedPhrases
    ),
    weakPhrases: mergePhraseList(
      defaults.governor.weakPhrases,
      saved.governor?.weakPhrases
    ),
    fabricationPatterns: mergePhraseList(
      defaults.governor.fabricationPatterns,
      saved.governor?.fabricationPatterns
    ),
    fabricatedStatsPatterns: mergePhraseList(
      defaults.governor.fabricatedStatsPatterns,
      saved.governor?.fabricatedStatsPatterns
    )
  }

  const hookAnalyzer: HookAnalyzerConfig = {
    ...defaults.hookAnalyzer,
    ...(saved.hookAnalyzer ?? {}),
    specificity: {
      ...defaults.hookAnalyzer.specificity,
      ...(saved.hookAnalyzer?.specificity ?? {})
    },
    length: {
      ...defaults.hookAnalyzer.length,
      ...(saved.hookAnalyzer?.length ?? {})
    },
    curiosityGap: {
      ...defaults.hookAnalyzer.curiosityGap,
      ...(saved.hookAnalyzer?.curiosityGap ?? {})
    },
    penalties: {
      ...defaults.hookAnalyzer.penalties,
      ...(saved.hookAnalyzer?.penalties ?? {})
    }
  }

  return {
    schemaVersion: saved.schemaVersion ?? defaults.schemaVersion,
    governor,
    hookAnalyzer,
    hookTypes: {
      ...defaults.hookTypes,
      ...(saved.hookTypes ?? {})
    },
    pipeline: {
      ...defaults.pipeline,
      ...(saved.pipeline ?? {})
    }
  }
}

/**
 * Merge a saved phrase list with defaults.
 * - Default entries appear with their saved enabled state (if overridden)
 * - Custom entries from saved config are appended
 * - New defaults (not in saved) appear as enabled
 */
export function mergePhraseList(
  defaults: GovernorConfig["bannedPhrases"],
  saved?: GovernorConfig["bannedPhrases"]
): GovernorConfig["bannedPhrases"] {
  if (!saved) return defaults

  const savedById = new Map(saved.map((s) => [s.id, s]))
  const result = defaults.map((d) => {
    const override = savedById.get(d.id)
    if (override) {
      return { ...d, enabled: override.enabled }
    }
    return d
  })

  // Append custom entries
  for (const s of saved) {
    if (s.isCustom) {
      result.push(s)
    }
  }

  return result
}

/** Load config from storage and merge with defaults. */
export async function initConfig(): Promise<PostPilotConfig> {
  const storage = getStorage()
  if (!storage) {
    currentConfig = buildDefaults()
    return currentConfig
  }

  return new Promise((resolve) => {
    storage.get(STORAGE_KEY, (result) => {
      const saved = result[STORAGE_KEY] as Partial<PostPilotConfig> | undefined
      currentConfig = saved ? mergeWithDefaults(saved) : buildDefaults()
      resolve(currentConfig)
    })
  })
}

/** Save config to storage. */
export async function saveConfig(config: PostPilotConfig): Promise<void> {
  currentConfig = config
  const storage = getStorage()
  if (!storage) return
  return new Promise((resolve) => {
    storage.set({ [STORAGE_KEY]: config }, resolve)
  })
}

/** Get the full config (sync, from cache). */
export function getConfig(): PostPilotConfig {
  return currentConfig
}

/** Get governor config section. */
export function getGovernorConfig(): GovernorConfig {
  return currentConfig.governor
}

/** Get hook analyzer config section. */
export function getHookAnalyzerConfig(): HookAnalyzerConfig {
  return currentConfig.hookAnalyzer
}

/** Get hook types config section. */
export function getHookTypesConfig(): HookTypesConfig {
  return currentConfig.hookTypes
}

/** Get pipeline config section. */
export function getPipelineConfig(): PipelineConfig {
  return currentConfig.pipeline
}

/** Register a listener for config changes (from other contexts). */
export function onConfigChanged(
  cb: (config: PostPilotConfig) => void
): () => void {
  changeListeners.push(cb)

  const storage = getStorage()
  if (storage) {
    const listener = (changes: Record<string, { newValue?: unknown }>) => {
      try {
        if (STORAGE_KEY in changes) {
          const saved = changes[STORAGE_KEY].newValue as
            | Partial<PostPilotConfig>
            | undefined
          currentConfig = saved ? mergeWithDefaults(saved) : buildDefaults()
          cb(currentConfig)
        }
      } catch {
        // Extension context invalidated
      }
    }
    storage.onChanged.addListener(listener)
    return () => {
      const idx = changeListeners.indexOf(cb)
      if (idx >= 0) changeListeners.splice(idx, 1)
      try { storage.onChanged.removeListener(listener) } catch {}
    }
  }

  return () => {
    const idx = changeListeners.indexOf(cb)
    if (idx >= 0) changeListeners.splice(idx, 1)
  }
}

/** Override config for testing (no storage write). */
export function setConfigForTesting(config: PostPilotConfig): void {
  currentConfig = config
}

/** Reset config to defaults for testing (no storage write). */
export function resetConfigForTesting(): void {
  currentConfig = buildDefaults()
}
