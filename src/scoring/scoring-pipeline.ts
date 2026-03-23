import type { PostScore } from "./types"
import type { VoiceFingerprint } from "./voice-types"

import { HookAnalyzer } from "./hook-analyzer"
import { checkGovernor } from "./governor"
import { scoreVoiceMatch } from "./voice-match"
import { getPipelineConfig } from "~config/config-storage"

const analyzer = new HookAnalyzer()

/** Run the full scoring pipeline on post text. */
export function scorePost(
  text: string,
  fingerprint?: VoiceFingerprint | null
): PostScore {
  const config = getPipelineConfig()
  const hookScore = analyzer.score(text)
  const governor = checkGovernor(text)
  const charCount = text.length
  const inSweetSpot =
    charCount >= config.sweetSpotMin && charCount <= config.sweetSpotMax

  const voiceMatch =
    fingerprint && text.length > 0
      ? scoreVoiceMatch(text, fingerprint)
      : null

  return {
    hookScore,
    governor,
    charCount,
    inSweetSpot,
    voiceMatch
  }
}
