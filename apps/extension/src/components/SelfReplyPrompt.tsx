import React from "react"

interface Props {
  suggestion: string
  onInsert: () => void
  onDismiss: () => void
}

export function SelfReplyPrompt({ suggestion, onInsert, onDismiss }: Props) {
  return (
    <div className="postpilot-self-reply">
      <div className="postpilot-details__heading">Self-reply (you still send it)</div>
      <div className="postpilot-self-reply__text">{suggestion}</div>
      <div className="postpilot-self-reply__actions">
        <button type="button" className="postpilot-save-btn" onClick={onInsert}>
          Insert
        </button>
        <button
          type="button"
          className="postpilot-save-btn"
          onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  )
}
