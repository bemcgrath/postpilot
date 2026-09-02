import { SURVEY_ENDPOINT } from "./survey-service"
import type { SurveyReasonId } from "./survey-service"

/** One POST, no identifier, ~1s budget. Result is discarded either way. */
export function sendSurveySignal(reason: SurveyReasonId, freetext?: string): void {
  try {
    fetch(SURVEY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, ...(freetext ? { freetext } : {}) }),
    }).catch(() => {})
  } catch {
    // Never let telemetry failure break the survey UX.
  }
}
