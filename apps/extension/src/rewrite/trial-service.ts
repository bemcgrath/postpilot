/**
 * Client for the worker's /v1/trial endpoint -- the 7-day no-card Pro trial
 * (pro-activation-spec-2026-08-31.md Change 2). Routed through the
 * background service worker so this module stays agnostic of content
 * script vs. options page, same pattern as rewrite-service.ts.
 */
import { getOrCreateDeviceId } from "./device-id-storage"
import { validateStoredLicense } from "~config/license"

export interface TrialStatus {
  active: boolean
  daysLeft?: number
  expiresAt?: string
}

function sendMessage<T>(type: string, body?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type, body },
      (response: { ok: boolean; data?: T; error?: string } | undefined) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        if (!response) {
          reject(new Error("NO_RESPONSE"))
          return
        }
        if (!response.ok) {
          reject(new Error(response.error ?? "API_ERROR"))
          return
        }
        resolve(response.data as T)
      }
    )
  })
}

/** Current trial status for this install's device id. Never throws -- treats any failure as "no trial". */
export async function getTrialStatus(): Promise<TrialStatus> {
  try {
    const deviceId = await getOrCreateDeviceId()
    return await sendMessage<TrialStatus>("GET_TRIAL_STATUS", { deviceId })
  } catch {
    return { active: false }
  }
}

/**
 * Starts the 7-day trial for this device (idempotent -- calling it again on
 * an already-trialing device just returns the existing status unchanged).
 */
export async function startTrial(): Promise<TrialStatus> {
  const deviceId = await getOrCreateDeviceId()
  return sendMessage<TrialStatus>("START_TRIAL", { deviceId })
}

export interface EffectiveTier {
  isPro: boolean
  isTrial: boolean
  trialDaysLeft?: number
}

/**
 * Combines license + trial into what the UI actually needs to render:
 * a real license always wins (and skips the trial network call entirely --
 * a Pro subscriber has no reason to be checked against a trial key), only
 * a `device` identity without an active license is ever mid-trial.
 */
export async function getEffectiveTier(): Promise<EffectiveTier> {
  const license = await validateStoredLicense()
  if (license.isActive) return { isPro: true, isTrial: false }
  const trial = await getTrialStatus()
  return { isPro: false, isTrial: trial.active, trialDaysLeft: trial.daysLeft }
}
