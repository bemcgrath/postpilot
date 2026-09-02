import { SURVEY_REASON_IDS } from "@postpilot/core/learning/survey"

/**
 * Local-only state for the upgrade-friction survey (privacy-first: what a
 * given user answered never leaves the machine). Keys in chrome.storage.local:
 *
 *   pp_survey_last_shown_v1  - epoch ms of the last time the prompt was shown
 *   pp_survey_answered_v1    - { reason: SurveyReasonId, text?: string, at: ISO } once answered
 *
 * Cooldown: 30 days after showing, or never again after answering.
 */

const LAST_SHOWN_KEY = "pp_survey_last_shown_v1"
const ANSWERED_KEY = "pp_survey_answered_v1"

const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000

/**
 * POST target for the anonymous, aggregated-only signal (worker/src/survey.ts).
 * Using the workers.dev URL directly for now -- api.postpilotforx.com isn't
 * live (postpilotforx.com's DNS isn't on Cloudflare yet, no custom domain
 * route exists). Switch back once that migration happens; see worker/wrangler.toml.
 */
export const SURVEY_ENDPOINT = "https://postpilot-rewrite-worker.brianemcgrath.workers.dev/v1/survey"

export { SURVEY_REASON_IDS }
export type SurveyReasonId = (typeof SURVEY_REASON_IDS)[number]

export const SURVEY_OPTIONS: Array<{ id: SurveyReasonId; label: string }> = [
  { id: "not_sure_what_id_get", label: "Not sure what I'd get" },
  { id: "too_expensive", label: "Too expensive" },
  { id: "not_used_enough", label: "Haven't used it enough yet" },
  { id: "just_browsing", label: "Just browsing" },
  { id: "other", label: "Other" },
]

interface AnsweredRecord {
  reason: SurveyReasonId
  text?: string
  at: string
}

function getStorage(): typeof chrome.storage.local | null {
  try {
    return typeof chrome !== "undefined" && typeof chrome.storage !== "undefined" ? chrome.storage.local : null
  } catch {
    return null
  }
}

export async function shouldShowSurvey(): Promise<boolean> {
  const storage = getStorage()
  if (!storage) return false
  try {
    const r = await storage.get([LAST_SHOWN_KEY, ANSWERED_KEY])
    if (r[ANSWERED_KEY]) return false
    const lastShown = typeof r[LAST_SHOWN_KEY] === "number" ? (r[LAST_SHOWN_KEY] as number) : 0
    return Date.now() - lastShown >= COOLDOWN_MS
  } catch {
    return false
  }
}

export async function markSurveyShown(): Promise<void> {
  const storage = getStorage()
  if (!storage) return
  try {
    await storage.set({ [LAST_SHOWN_KEY]: Date.now() })
  } catch {
    // Non-fatal -- worst case the prompt re-shows after cooldown anyway.
  }
}

/** Persist the answer locally (never re-show) and fire the anonymous aggregate signal. */
export async function submitSurveyResponse(reason: SurveyReasonId, freetext?: string): Promise<void> {
  const record: AnsweredRecord = { reason, at: new Date().toISOString() }
  const trimmed = freetext?.trim().slice(0, 500)
  if (trimmed) record.text = trimmed.slice(0, 500)

  const storage = getStorage()
  if (storage) {
    try {
      await storage.set({ [ANSWERED_KEY]: record })
    } catch {
      // Local persistence failed; still send the anonymous signal below.
    }
  }

  // Fire-and-forget. The signal carries no identifier: one enum value plus an
  // optional capped freetext, same privacy posture as the roadmap vote widget.
  // Endpoint lives in a separate module so this import is the only trace.
  void import("./survey-endpoint")
    .then((m) => m.sendSurveySignal(reason, trimmed || undefined))
    .catch(() => {})
}
