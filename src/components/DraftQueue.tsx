import React from "react"
import type { DraftEntry } from "~drafts/draft-storage"
import { humanizeHookType } from "~scoring/hook-types"

interface Props {
  drafts: DraftEntry[]
  onRestore: (draft: DraftEntry) => void
  onDelete: (id: string) => void
}

function scoreColor(score: number): string {
  if (score >= 70) return "#00ba7c"
  if (score >= 50) return "#f7b731"
  return "#f4212e"
}

function relativeTime(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function DraftQueue({ drafts, onRestore, onDelete }: Props) {
  if (drafts.length === 0) return null

  return (
    <div className="postpilot-drafts">
      <div className="postpilot-details__heading">
        Saved Drafts ({drafts.length})
      </div>
      {drafts.map((draft) => (
        <div key={draft.id} className="postpilot-drafts__row">
          <span
            className="postpilot-drafts__score"
            style={{ color: scoreColor(draft.score) }}>
            {draft.score}
          </span>
          <div className="postpilot-drafts__body">
            <div className="postpilot-drafts__text">
              {draft.text.length > 80
                ? draft.text.slice(0, 80) + "…"
                : draft.text}
            </div>
            <div className="postpilot-drafts__meta">
              {draft.hookType ? humanizeHookType(draft.hookType) : "No hook"}
              {" · "}
              {relativeTime(draft.savedAt)}
            </div>
          </div>
          <div className="postpilot-drafts__actions">
            <button
              className="postpilot-drafts__btn postpilot-drafts__btn--restore"
              onClick={() => onRestore(draft)}
              title="Load into compose box">
              Load
            </button>
            <button
              className="postpilot-drafts__btn postpilot-drafts__btn--delete"
              onClick={() => onDelete(draft.id)}
              title="Delete draft">
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
