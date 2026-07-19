import React from "react"
import { REVIEW_URL, markPromptDone } from "~review/review-prompt-storage"

interface Props {
  onDone: () => void
}

export function ReviewPrompt({ onDone }: Props) {
  function retire() {
    markPromptDone().catch(() => {})
    onDone()
  }

  return (
    <div className="postpilot-review">
      <span className="postpilot-review__text">
        3 posts scored 70+ — PostPilot working for you? A Chrome Web Store
        review helps a lot.
      </span>
      <a
        className="postpilot-review__link"
        href={REVIEW_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={retire}>
        Leave a review
      </a>
      <button
        className="postpilot-review__dismiss"
        aria-label="Dismiss"
        onClick={retire}>
        ×
      </button>
    </div>
  )
}
