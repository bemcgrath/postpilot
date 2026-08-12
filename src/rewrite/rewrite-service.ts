import type { PostScore } from "~scoring/types"
import type { ScoreContext } from "~scoring/scoring-pipeline"
import { humanizeHookType } from "~scoring/hook-types"
import { loadLicenseStatus } from "~config/license"
import { loadFingerprint, loadVoiceOverrides } from "~scoring/voice-storage"
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
}

interface RewriteRequestBody {
  identity: Identity
  originalText: string
  isReply: boolean
  hookInfo: string
  governorLines: string
  suggestionLines: string
  band?: { min: number; max: number }
  count: 1 | 3
  voiceDigest?: VoiceDigest
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
 * Sent regardless of tier -- the worker is the enforcement boundary and
 * strips this for Free callers, so there's no need to duplicate that gating
 * here (see plan doc Part 1b).
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
  }
}

function buildRequestBody(
  originalText: string,
  score: PostScore,
  identity: Identity,
  count: 1 | 3,
  voiceDigest: VoiceDigest | undefined,
  context?: ScoreContext
): RewriteRequestBody {
  const isReply = context?.kind === "reply"

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

  const band = context?.replyInsights?.optimalLengthRange

  return {
    identity,
    originalText,
    isReply,
    hookInfo,
    governorLines,
    suggestionLines,
    band,
    count,
    voiceDigest,
  }
}

function parseRewrites(data: unknown): RewriteSuggestion[] {
  const d = data as { rewrites?: RewriteSuggestion[] }
  return d.rewrites ?? []
}

export async function generateRewrites(
  originalText: string,
  score: PostScore,
  isPro: boolean,
  context?: ScoreContext
): Promise<RewriteSuggestion[]> {
  const [identity, voiceDigest] = await Promise.all([resolveIdentity(), buildVoiceDigest()])
  const body = buildRequestBody(originalText, score, identity, isPro ? 3 : 1, voiceDigest, context)

  // Route through background service worker -- consistent with the rest of
  // the extension's network calls, and keeps this module ignorant of
  // whether it's running in a content script or the options page.
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "GENERATE_REWRITES", body },
      (response: { ok: boolean; data?: unknown; error?: string; resetsAt?: string }) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        if (!response.ok) {
          const err = new Error(response.error ?? "API_ERROR") as Error & { resetsAt?: string }
          if (response.resetsAt) err.resetsAt = response.resetsAt
          reject(err)
          return
        }
        try {
          resolve(parseRewrites(response.data))
        } catch (e) {
          reject(e)
        }
      }
    )
  })
}
