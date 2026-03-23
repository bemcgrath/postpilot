import React from "react"

import type { ScoreBreakdown as ScoreBreakdownType } from "~scoring/types"

interface Props {
  breakdown: ScoreBreakdownType
  suggestions: string[]
}

const ROWS: Array<{ key: keyof ScoreBreakdownType; label: string; max: number }> = [
  { key: "hookType", label: "Hook Type", max: 15 },
  { key: "specificity", label: "Specificity", max: 20 },
  { key: "length", label: "Length", max: 10 },
  { key: "curiosityGap", label: "Curiosity Gap", max: 15 },
  { key: "patternMatch", label: "Learned Patterns", max: 10 },
  { key: "penalties", label: "Penalties", max: 0 }
]

export function ScoreBreakdown({ breakdown, suggestions }: Props) {
  return (
    <>
      <div className="postpilot-details__section">
        <div className="postpilot-details__heading">Score Breakdown</div>
        {ROWS.map(({ key, label, max }) => {
          const value = breakdown[key] as number

          let valueClass = "postpilot-breakdown__value"
          if (value > 0) valueClass += " postpilot-breakdown__value--positive"
          else if (value < 0)
            valueClass += " postpilot-breakdown__value--negative"

          return (
            <div key={key}>
              <div className="postpilot-breakdown__row">
                <span className="postpilot-breakdown__label">{label}</span>
                <span className={valueClass}>
                  {value > 0 ? "+" : ""}
                  {value}
                  {max > 0 ? `/${max}` : ""}
                </span>
              </div>
              {key === "penalties" &&
                breakdown.penaltyReasons.length > 0 && (
                  <div style={{ paddingLeft: 12, paddingBottom: 2 }}>
                    {breakdown.penaltyReasons.map((reason, i) => (
                      <div
                        key={i}
                        style={{ fontSize: 11, color: "#f4212e" }}>
                        {reason}
                      </div>
                    ))}
                  </div>
                )}
            </div>
          )
        })}
      </div>

      {suggestions.length > 0 && (
        <div className="postpilot-details__section">
          <div className="postpilot-details__heading">Suggestions</div>
          {suggestions.map((s, i) => (
            <div key={i} className="postpilot-suggestions__item">
              {s}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
