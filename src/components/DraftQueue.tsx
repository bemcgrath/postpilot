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
  const [picked, setPicked] = React.useState<string[]>([])

  if (drafts.length === 0) return null

  const togglePick = (id: string) => {
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 2) return [prev[1], id]
      return [...prev, id]
    })
  }

  const a = drafts.find((d) => d.id === picked[0])
  const b = drafts.find((d) => d.id === picked[1])

  return (
    <div className="postpilot-drafts">
      <div className="postpilot-details__heading">
        Saved Drafts ({drafts.length})
        {drafts.length >= 2 && (
          <span className="postpilot-drafts__hint">
            {" "}
            — pick two to compare
          </span>
        )}
      </div>
      {a && b && (
        <div className="postpilot-compare">
          <div className="postpilot-compare__col">
            <div className="postpilot-compare__score" style={{ color: scoreColor(a.score) }}>
              {a.score}
            </div>
            <div className="postpilot-compare__meta">
              {a.hookType ? humanizeHookType(a.hookType) : "No hook"} · {a.text.length} chars
            </div>
            <button
              className="postpilot-drafts__btn postpilot-drafts__btn--restore"
              onClick={() => onRestore(a)}>
              Load A
            </button>
          </div>
          <div className="postpilot-compare__vs">vs</div>
          <div className="postpilot-compare__col">
            <div className="postpilot-compare__score" style={{ color: scoreColor(b.score) }}>
              {b.score}
            </div>
            <div className="postpilot-compare__meta">
              {b.hookType ? humanizeHookType(b.hookType) : "No hook"} · {b.text.length} chars
            </div>
            <button
              className="postpilot-drafts__btn postpilot-drafts__btn--restore"
              onClick={() => onRestore(b)}>
              Load B
            </button>
          </div>
        </div>
      )}
      {drafts.map((draft) => (
        <div key={draft.id} className="postpilot-drafts__row">
          {drafts.length >= 2 && (
            <button
              type="button"
              className={`postpilot-drafts__pick${picked.includes(draft.id) ? " postpilot-drafts__pick--on" : ""}`}
              onClick={() => togglePick(draft.id)}
              title="Compare">
              {picked[0] === draft.id ? "A" : picked[1] === draft.id ? "B" : "+"}
            </button>
          )}
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
