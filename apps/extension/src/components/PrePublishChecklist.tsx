import React from "react"
import type { ChecklistItem } from "@postpilot/core/scoring/checklist"

interface Props {
  items: ChecklistItem[]
}

export function PrePublishChecklist({ items }: Props) {
  if (items.length === 0) return null

  return (
    <div className="postpilot-details__section">
      <div className="postpilot-details__heading">Before you send</div>
      {items.map((item) => (
        <div key={item.id} className="postpilot-checklist__row">
          <span
            className={
              item.ok
                ? "postpilot-checklist__mark postpilot-checklist__mark--ok"
                : "postpilot-checklist__mark postpilot-checklist__mark--bad"
            }>
            {item.ok ? "\u2713" : "\u2717"}
          </span>
          <span className="postpilot-checklist__label">{item.label}</span>
        </div>
      ))}
    </div>
  )
}
