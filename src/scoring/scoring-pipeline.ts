import type { HookTypeName, PostScore } from "./types"
import type { VoiceFingerprint, VoiceOverrides } from "./voice-types"
import type { ReplyCraftBenchmarks } from "./reply-craft"
import type { ComposerKind } from "./reply-context"

import { HookAnalyzer } from "./hook-analyzer"
import { checkGovernor } from "./governor"
import { scoreVoiceMatch } from "./voice-match"
import { applyOverrides } from "./voice-fingerprint"
import { scoreReplyCraft } from "./reply-craft"
import { getPipelineConfig, getHookAnalyzerConfig } from "~config/config-storage"

const analyzer = new HookAnalyzer()

/**
 * Reply-side learned benchmarks, structurally compatible with (but decoupled
 * from) learning/types.ts's ReplyCraftInsights -- scoring must not import
 * from learning, matching the existing dependency direction in this codebase.
 * A caller passing the real ReplyCraftInsights object satisfies this shape
 * with no adapter needed.
 */
export interface ReplyScoringBenchmarks extends ReplyCraftBenchmarks {
  hookTypeBoosts?: Partial<Record<HookTypeName, number>>
}

export interface ScoreContext {
  kind?: ComposerKind // default "original"
  replyInsights?: ReplyScoringBenchmarks | null // learned band + boosts, Pro only
  parentText?: string | null // for adds-vs-echoes, optional
}

/** Run the full scoring pipeline on post text. */
export function scorePost(
  text: string,
  fingerprint?: VoiceFingerprint | null,
  hookTypeBoosts?: Partial<Record<HookTypeName, number>>,
  overrides?: VoiceOverrides | null,
  context?: ScoreContext
): PostScore {
  const config = getPipelineConfig()
  // "unknown" (ambiguous DOM signals) and "original" both score identically
  // here -- an ambiguous surface must never regress into being mis-scored
  // as a reply.
  const kind: ComposerKind = context?.kind ?? "original"
  const isReply = kind === "reply"

  // Learned reply boosts beat the originals' boosts beat nothing, mirroring
  // how learned hookTypeBoosts already take precedence over configured
  // baseWeight elsewhere in this pipeline.
  const effectiveHookTypeBoosts = isReply
    ? (context?.replyInsights?.hookTypeBoosts ?? hookTypeBoosts)
    : hookTypeBoosts

  let hookScore = analyzer.score(text, undefined, effectiveHookTypeBoosts, isReply)

  let replyCraft = null
  if (isReply) {
    replyCraft = scoreReplyCraft(text, {
      parentText: context?.parentText,
      benchmarks: context?.replyInsights ?? null
    })
    const weakThreshold = getHookAnalyzerConfig().weakThreshold
    const adjustedTotal = Math.max(
      0,
      Math.min(100, hookScore.totalScore + replyCraft.score)
    )
    hookScore = {
      ...hookScore,
      totalScore: adjustedTotal,
      breakdown: { ...hookScore.breakdown, replyCraft: replyCraft.score },
      isWeak: adjustedTotal < weakThreshold
    }
  }

  const governor = checkGovernor(text)
  const charCount = text.length

  const sweetSpotRange = isReply
    ? (context?.replyInsights?.optimalLengthRange ?? {
        min: config.replySweetSpotMin,
        max: config.replySweetSpotMax
      })
    : { min: config.sweetSpotMin, max: config.sweetSpotMax }
  const inSweetSpot =
    charCount >= sweetSpotRange.min && charCount <= sweetSpotRange.max

  let effectiveFp = fingerprint ?? null
  if (effectiveFp && overrides) {
    effectiveFp = applyOverrides(effectiveFp, overrides)
  }

  // Voice fingerprints are built from originals only (best-posts.ts excludes
  // replies from the fingerprint corpus, to avoid a reactive response
  // skewing the user's own voice) -- so every dimension here (avg length,
  // vocabulary, tone) reflects originals, not replies. Scoring a reply
  // against it isn't "a worse match," it's a wrong comparison: a live-tested
  // reply landed a false 0/100 on Length simply for being shorter than the
  // user's own post average, which was never a meaningful signal for a
  // reply in the first place.
  const voiceMatch =
    !isReply && effectiveFp && text.length > 0
      ? scoreVoiceMatch(text, effectiveFp)
      : null

  return {
    hookScore,
    governor,
    charCount,
    inSweetSpot,
    voiceMatch,
    kind,
    sweetSpotRange,
    replyCraft
  }
}
