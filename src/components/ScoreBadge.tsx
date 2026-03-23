import React from "react"

interface Props {
  score: number
}

export function ScoreBadge({ score }: Props) {
  const colorClass =
    score >= 70
      ? "postpilot-badge--green"
      : score >= 50
        ? "postpilot-badge--yellow"
        : "postpilot-badge--red"

  return <div className={`postpilot-badge ${colorClass}`}>{score}</div>
}
