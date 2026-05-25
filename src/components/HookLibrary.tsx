import React, { useState } from "react"

import type { HookEntry } from "~hooks/hook-storage"
import { humanizeHookType } from "~scoring/hook-types"

function scoreColor(s: number): string {
  if (s >= 70) return "#00ba7c"
  if (s >= 50) return "#f7b731"
  return "#f4212e"
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms
  const days = Math.floor(diff / 86400000)
  if (days === 0) return "today"
  if (days === 1) return "yesterday"
  return `${days}d ago`
}

interface Props {
  hooks: HookEntry[]
  onUse: (entry: HookEntry) => void
  onDelete: (id: string) => void
}

export function HookLibrary({ hooks, onUse, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (hooks.length === 0) return null

  const visible = expanded ? hooks : hooks.slice(0, 3)

  return (
    <div className="postpilot-hooklist">
      <div className="postpilot-hooklist__header">
        <span className="postpilot-hooklist__title">Hook Library</span>
        <span className="postpilot-hooklist__count">{hooks.length} saved</span>
      </div>
      {visible.map((h) => (
        <div key={h.id} className="postpilot-hooklist__row">
          <span
            className="postpilot-hooklist__score"
            style={{ color: scoreColor(h.score) }}>
            {h.score}
          </span>
          {h.hookType && (
            <span className="postpilot-hooklist__type">
              {humanizeHookType(h.hookType)}
            </span>
          )}
          <span className="postpilot-hooklist__text">{h.hook}</span>
          <span className="postpilot-hooklist__meta">{relativeTime(h.savedAt)}</span>
          <button
            className="postpilot-hooklist__use"
            onClick={() => onUse(h)}>
            Use
          </button>
          <button
            className="postpilot-hooklist__del"
            onClick={() => onDelete(h.id)}>
            ×
          </button>
        </div>
      ))}
      {hooks.length > 3 && (
        <button
          className="postpilot-hooklist__more"
          onClick={() => setExpanded(!expanded)}>
          {expanded ? "Show less" : `Show ${hooks.length - 3} more`}
        </button>
      )}
    </div>
  )
}
