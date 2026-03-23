import React from "react"

import type { VoiceMatchResult } from "~scoring/voice-types"

interface Props {
  voiceMatch: VoiceMatchResult
}

export function VoiceMatchBreakdown({ voiceMatch }: Props) {
  return (
    <div className="postpilot-details__section">
      <div className="postpilot-details__heading">Voice Match</div>
      {voiceMatch.dimensions.map((dim) => {
        let valueClass = "postpilot-breakdown__value"
        if (dim.score >= 60) valueClass += " postpilot-breakdown__value--positive"
        else if (dim.score < 40)
          valueClass += " postpilot-breakdown__value--negative"

        return (
          <div key={dim.name}>
            <div className="postpilot-breakdown__row">
              <span className="postpilot-breakdown__label">{dim.name}</span>
              <span className={valueClass}>{dim.score}/100</span>
            </div>
            {dim.feedback && (
              <div style={{ paddingLeft: 12, paddingBottom: 2 }}>
                <div style={{ fontSize: 11, color: "#71767b" }}>
                  {dim.feedback}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
