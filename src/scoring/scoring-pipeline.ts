import type { HookTypeName, PostScore } from "./types"
import type { VoiceFingerprint, VoiceOverrides } from "./voice-types"

import { HookAnalyzer } from "./hook-analyzer"
import { checkGovernor } from "./governor"
import { scoreVoiceMatch } from "./voice-match"
import { applyOverrides } from "./voice-fingerprint"
import { getPipelineConfig } from "~config/config-storage"

const analyzer = new HookAnalyzer()

/** Run the full scoring pipeline on post text. */
export function scorePost(
  text: string,
  fingerprint?: VoiceFingerprint | null,
  hookTypeBoosts?: Partial<Record<HookTypeName, number>>,
  overrides?: VoiceOverrides | null
): PostScore {
  const config = getPipelineConfig()
  const hookScore = analyzer.score(text, undefined, hookTypeBoosts)
  const governor = checkGovernor(text)
  const charCount = text.length
  const inSweetSpot =
    charCount >= config.sweetSpotMin && charCount <= config.sweetSpotMax

  let effectiveFp = fingerprint ?? null
  if (effectiveFp && overrides) {
    effectiveFp = applyOverrides(effectiveFp, overrides)
  }

  const voiceMatch =
    effectiveFp && text.length > 0
      ? scoreVoiceMatch(text, effectiveFp)
      : null

  return {
    hookScore,
    governor,
    charCount,
    inSweetSpot,
    voiceMatch
  }
}
