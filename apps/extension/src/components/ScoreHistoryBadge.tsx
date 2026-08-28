import React from "react"
import type { WeekStats } from "~history/score-history-storage"

interface Props {
  stats: WeekStats
}

export function ScoreHistoryBadge({ stats }: Props) {
  if (stats.thisWeekCount === 0) return null

  const avg = stats.thisWeekAvg!
  const avgColor =
    avg >= 70 ? "#00ba7c" : avg >= 50 ? "#f7b731" : "#f4212e"

  let trend: string | null = null
  let trendColor = "#71767b"
  if (stats.lastWeekAvg !== null) {
    const delta = avg - stats.lastWeekAvg
    if (delta > 2) {
      trend = `+${delta} vs last week`
      trendColor = "#00ba7c"
    } else if (delta < -2) {
      trend = `${delta} vs last week`
      trendColor = "#f4212e"
    } else {
      trend = "steady"
    }
  }

  return (
    <div className="postpilot-history">
      <div className="postpilot-details__heading">Your 7-Day Average</div>
      <div className="postpilot-history__row">
        <span className="postpilot-history__avg" style={{ color: avgColor }}>
          {avg}
        </span>
        <span className="postpilot-history__meta">
          from {stats.thisWeekCount} post{stats.thisWeekCount !== 1 ? "s" : ""}
        </span>
        {trend && (
          <span className="postpilot-history__trend" style={{ color: trendColor }}>
            {trend}
          </span>
        )}
      </div>
    </div>
  )
}
