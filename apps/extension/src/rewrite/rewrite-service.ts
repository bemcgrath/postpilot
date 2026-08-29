import type { PostScore } from "@postpilot/core/scoring/types"
import type { ScoreContext } from "@postpilot/core/scoring/scoring-pipeline"
import { humanizeHookType } from "@postpilot/core/scoring/hook-types"
import { loadLicenseStatus } from "~config/license"
import { loadFingerprint, loadVoiceOverrides } from "@postpilot/core/scoring/voice-storage"
import { getOrCreateDeviceId } from "./device-id-storage"

export interface RewriteSuggestion {
  text: string
  hookType?: string
  rationale: string
}

interface Identity {
  type: "license" | "device"
  licenseKey?: string
  instanceId?: string
  deviceId?: string
}

interface VoiceDigest {
  distinctiveTerms: string[]
  sentenceLengthTarget: number
  firstPersonRatio: number
  secondPersonRatio: number
  topHookTypes: string[]
  signatureWords?: string[]
  fragmentRatio?: number
  lineBreaksPerPost?: number
  usesColons?: number
  usesLists?: number
}

interface RewriteRequestBody {
  identity: Identity
  originalText: string
  isReply: boolean
  hookInfo: string
  governorLines: string
  suggestionLines: string
  engagementLines?: string
  band?: { min: number; max: number }
  count: 1 | 3
  voiceDigest?: VoiceDigest
  mode?: "full" | "hook"
}

/**
 * Derives the identity to send with a rewrite request. The worker
 * independently re-validates any license against LemonSqueezy -- this is
 * just "who's asking", not a trust claim. Falls back to the anonymous
 * per-install device id when no license is stored locally.
 */
async function resolveIdentity(): Promise<Identity> {
  const license = await loadLicenseStatus()
  if (license.licenseKey && license.instanceId) {
    return { type: "license", licenseKey: license.licenseKey, instanceId: license.instanceId }
  }
  return { type: "device", deviceId: await getOrCreateDeviceId() }
}

/**
 * Compact style digest from the user's Voice Fingerprint, if one exists.
 * Only sent for Pro — Free never transmits a voice profile.
 */
async function buildVoiceDigest(): Promise<VoiceDigest | undefined> {
  const fingerprint = await loadFingerprint()
  if (!fingerprint) return undefined
  const overrides = await loadVoiceOverrides()
  return {
    distinctiveTerms: fingerprint.distinctiveTerms.slice(0, 10).map((t) => t.term),
    sentenceLengthTarget: fingerprint.sentenceLength.mean,
    firstPersonRatio: fingerprint.firstPersonRatio,
    secondPersonRatio: fingerprint.secondPersonRatio,
    topHookTypes: fingerprint.topHookTypes.map(humanizeHookType),
    signatureWords: overrides.addSignatureWords.length ? overrides.addSignatureWords : undefined,
    fragmentRatio: fingerprint.fragmentRatio,
    lineBreaksPerPost: fingerprint.lineBreakFrequency.mean,
    usesColons: fingerprint.usesColons,
    usesLists: fingerprint.usesLists,
  }
}

/** Same lean-in / avoid cutoffs the compose badge uses (hook-analyzer pattern match). */
const LEAN_IN_BOOST = 1.15
const AVOID_BOOST = 0.85

/**
 * Compact "what earns engagement for this writer" block for the rewrite
 * worker. Neutral multipliers (0.85–1.15) are omitted — they aren't a signal.
 */
export function formatEngagementLines(
  boosts?: Partial<Record<string, number>>
): string | undefined {
  if (!boosts) return undefined
  const entries = Object.entries(boosts).filter(
    (entry): entry is [string, number] => typeof entry[1] === "number"
  )
  const leanIn = entries
    .filter(([, n]) => n >= LEAN_IN_BOOST)
    .sort((a, b) => b[1] - a[1])
  const avoid = entries
    .filter(([, n]) => n < AVOID_BOOST)
    .sort((a, b) => a[1] - b[1])
  if (!leanIn.length && !avoid.length) return undefined
  const lines: string[] = []
  if (leanIn.length) {
    lines.push(
      "Lean in: " +
        leanIn.map(([k, n]) => `${humanizeHookType(k)} (${n.toFixed(2)}x)`).join(", ")
    )
  }
  if (avoid.length) {
    lines.push(
      "Avoid: " +
        avoid.map(([k, n]) => `${humanizeHookType(k)} (${n.toFixed(2)}x)`).join(", ")
    )
  }
  return lines.join("\n")
}

function buildRequestBody(
  originalText: string,
  score: PostScore,
  identity: Identity,
  count: 1 | 3,
  voiceDigest: VoiceDigest | undefined,
  context?: ScoreContext,
  hookTypeBoosts?: Partial<Record<string, number>>,
  mode: "full" | "hook" = "full"
): RewriteRequestBody {
  const isReply = context?.kind === "reply"
  const hookOnly = mode === "hook" && !isReply

  const governorLines = score.governor.issues
    .filter((i) => i.severity === "error" || i.severity === "warning")
    .map((i) => `- ${i.message} (matched: "${i.matchedText}")`)
    .join("\n")

  const hookInfo = score.hookScore.hookType
    ? `${humanizeHookType(score.hookScore.hookType)} hook — score ${score.hookScore.totalScore}/100`
    : `No recognized hook — score ${score.hookScore.totalScore}/100`

  const suggestionLines = score.hookScore.suggestions?.length
    ? score.hookScore.suggestions.map((s) => `- ${s}`).join("\n")
    : ""

  const band = isReply
    ? context?.replyInsights?.optimalLengthRange
    : context?.originalLengthRange ?? undefined

  const boosts = isReply
    ? (context?.replyInsights?.hookTypeBoosts ?? hookTypeBoosts)
    : hookTypeBoosts

  return {
    identity,
    originalText,
    isReply,
    hookInfo,
    governorLines,
    suggestionLines,
    engagementLines: formatEngagementLines(boosts),
    band: hookOnly ? undefined : band,
    count,
    voiceDigest,
    mode: hookOnly ? "hook" : undefined,
  }
}

function parseRewriteResponse(data: unknown): {
  suggestions: RewriteSuggestion[]
  remaining?: number
  resetsAt?: string
  tier?: "free" | "pro"
} {
  const d = data as {
    rewrites?: RewriteSuggestion[]
    remaining?: number
    resetsAt?: string
    tier?: "free" | "pro"
  }
  return {
    suggestions: d.rewrites ?? [],
    remaining: typeof d.remaining === "number" ? d.remaining : undefined,
    resetsAt: typeof d.resetsAt === "string" ? d.resetsAt : undefined,
    tier: d.tier === "pro" || d.tier === "free" ? d.tier : undefined,
  }
}

export async function generateRewrites(
  originalText: string,
  score: PostScore,
  isPro: boolean,
  context?: ScoreContext,
  hookTypeBoosts?: Partial<Record<string, number>>,
  mode: "full" | "hook" = "full"
): Promise<{
  suggestions: RewriteSuggestion[]
  remaining?: number
  resetsAt?: string
}> {
  const [identity, voiceDigest] = await Promise.all([
    resolveIdentity(),
    isPro ? buildVoiceDigest() : Promise.resolve(undefined)
  ])
  const body = buildRequestBody(
    originalText,
    score,
    identity,
    isPro ? 3 : 1,
    voiceDigest,
    context,
    hookTypeBoosts,
    mode
  )

  // Route through background service worker -- consistent with the rest of
  // the extension's network calls, and keeps this module ignorant of
  // whether it's running in a content script or the options page.
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "GENERATE_REWRITES", body },
      (response: { ok: boolean; data?: unknown; error?: string; resetsAt?: string } | undefined) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        if (!response) {
          reject(new Error("NO_RESPONSE"))
          return
        }
        if (!response.ok) {
          const err = new Error(response.error ?? "API_ERROR") as Error & { resetsAt?: string }
          if (response.resetsAt) err.resetsAt = response.resetsAt
          reject(err)
          return
        }
        try {
          resolve(parseRewriteResponse(response.data))
        } catch (e) {
          reject(e)
        }
      }
    )
  })
}
