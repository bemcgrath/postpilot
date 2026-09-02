import React, { useState } from "react"

import { SURVEY_OPTIONS, markSurveyShown, submitSurveyResponse } from "~rewrite/survey-service"
import type { SurveyReasonId } from "~rewrite/survey-service"

/**
 * Lightweight, non-blocking "what's stopping you from going Pro?" prompt.
 * Rendered *next to* the free-tier quota-exhausted upsell in
 * RewriteSuggestions -- never replaces it, never blocks the workflow.
 * Gating (30-day cooldown / answered-once) is decided by the caller via
 * shouldShowSurvey(); this component only handles shown-marking on mount.
 */
export function SurveyPrompt() {
  const [reason, setReason] = useState<SurveyReasonId | null>(null)
  const [freetext, setFreetext] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // Record that the prompt was shown so the 30-day cooldown starts even if
  // the user dismisses without answering.
  React.useEffect(() => {
    void markSurveyShown()
  }, [])

  if (dismissed) return null

  const submit = async () => {
    if (!reason || submitting) return
    setSubmitting(true)
    await submitSurveyResponse(reason, freetext || undefined)
    setDone(true)
    setSubmitting(false)
  }

  return (
    <div className="postpilot-survey">
      <button
        className="postpilot-survey__close"
        title="Dismiss"
        aria-label="Dismiss survey"
        onClick={() => setDismissed(true)}>
        ×
      </button>

      {done ? (
        <div className="postpilot-survey__thanks">Thanks — that helps us know what to improve.</div>
      ) : (
        <>
          <div className="postpilot-survey__question">What's stopping you from going Pro?</div>
          <div className="postpilot-survey__options">
            {SURVEY_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                className={`postpilot-survey__option${reason === opt.id ? " postpilot-survey__option--selected" : ""}`}
                onClick={() => setReason(opt.id)}>
                {opt.label}
              </button>
            ))}
          </div>
          {reason === "other" && (
            <textarea
              className="postpilot-survey__freetext"
              maxLength={500}
              rows={2}
              placeholder="Anything you'd like us to know? (optional)"
              value={freetext}
              onChange={(e) => setFreetext(e.target.value)}
            />
          )}
          {reason && reason !== "other" && (
            <textarea
              className="postpilot-survey__freetext"
              maxLength={500}
              rows={2}
              placeholder="Tell us more? (optional)"
              value={freetext}
              onChange={(e) => setFreetext(e.target.value)}
            />
          )}
          <button className="postpilot-survey__submit" disabled={!reason || submitting} onClick={submit}>
            {submitting ? "Sending…" : "Send"}
          </button>
          <div className="postpilot-survey__privacy">Anonymous — we don't collect your account or posts.</div>
        </>
      )}
    </div>
  )
}
