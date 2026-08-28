import React from "react"

import type { LearnedInsights } from "@postpilot/core/learning/types"
import type { HookTypeName } from "@postpilot/core/scoring/types"
import { humanizeHookType } from "@postpilot/core/scoring/hook-types"

interface InsightsPanelProps {
  insights: LearnedInsights
  currentHookType: HookTypeName | null
  isReply?: boolean
}

export function InsightsPanel({ insights, currentHookType, isReply = false }: InsightsPanelProps) {
  if (!insights.isReady) return null

  // Replies have their own dedicated craft guidance -- show that instead of
  // the originals-only hook/recommendation view, which doesn't apply to them.
  if (isReply) {
    if (!insights.replyInsights) return null
    const reply = insights.replyInsights
    return (
      <div className="postpilot-details__section">
        <div className="postpilot-details__heading">Your Reply Data</div>
        <div className="postpilot-insights__recs">
          <div className="postpilot-insights__rec">{reply.recommendation}</div>
        </div>
        <div className="postpilot-insights__meta">
          Learned band: {reply.optimalLengthRange.min}-{reply.optimalLengthRange.max} chars
          {" · "}
          {reply.repliesAnalyzed} replies analyzed
        </div>
      </div>
    )
  }

  const currentBoost = currentHookType
    ? insights.hookTypeBoosts[currentHookType]
    : undefined

  const topRecs = insights.recommendations.slice(0, 3)

  return (
    <div className="postpilot-details__section">
      <div className="postpilot-details__heading">Your Data</div>

      {currentHookType && currentBoost != null && (
        <div className="postpilot-insights__current">
          <span className="postpilot-insights__label">
            {humanizeHookType(currentHookType)}:
          </span>
          <span
            className={
              currentBoost >= 1.15
                ? "postpilot-insights__boost--positive"
                : currentBoost < 0.85
                  ? "postpilot-insights__boost--negative"
                  : "postpilot-insights__boost--neutral"
            }>
            {currentBoost.toFixed(1)}x your baseline
          </span>
        </div>
      )}

      {topRecs.length > 0 && (
        <div className="postpilot-insights__recs">
          {topRecs.map((rec, i) => (
            <div key={i} className="postpilot-insights__rec">
              {rec.text}
            </div>
          ))}
        </div>
      )}

      <div className="postpilot-insights__meta">
        Based on {insights.postsAnalyzed} posts
      </div>
    </div>
  )
}
