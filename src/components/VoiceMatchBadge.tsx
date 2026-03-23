import React from "react"

import type { VoiceMatchResult } from "~scoring/voice-types"

interface Props {
  voiceMatch: VoiceMatchResult
}

export function VoiceMatchBadge({ voiceMatch }: Props) {
  const score = voiceMatch.totalScore
  const colorClass =
    score >= 70
      ? "postpilot-voice-badge--green"
      : score >= 50
        ? "postpilot-voice-badge--yellow"
        : "postpilot-voice-badge--red"

  return (
    <span className={`postpilot-voice-badge ${colorClass}`}>
      {score} Voice
    </span>
  )
}
