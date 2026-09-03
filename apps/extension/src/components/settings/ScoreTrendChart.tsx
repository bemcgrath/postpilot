import React from "react"

import type { ScoreEntry } from "@postpilot/core/history/score-history-storage"

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const WEEKS_TO_SHOW = 13

export interface ScoreTrendPoint {
  average: number
  count: number
  timestamp: number
}

// Buckets are rolling 7-day windows anchored to `now` (age 0-7 days, 7-14 days, ...),
// matching getWeekStats' definition of "this week" / "last week" so the chart's
// latest point always agrees with the average shown next to it.
export function buildWeeklyScoreTrend(entries: ScoreEntry[], now = Date.now()): ScoreTrendPoint[] {
  const buckets: ScoreEntry[][] = Array.from({ length: WEEKS_TO_SHOW }, () => [])

  for (const entry of entries) {
    const age = now - entry.timestamp
    if (age < 0 || age >= WEEKS_TO_SHOW * WEEK_MS) continue
    buckets[Math.floor(age / WEEK_MS)].push(entry)
  }

  return buckets
    .map((scores, index) => ({
      timestamp: now - index * WEEK_MS,
      count: scores.length,
      average: scores.length > 0
        ? Math.round(scores.reduce((sum, entry) => sum + entry.score, 0) / scores.length)
        : null
    }))
    .filter((point): point is ScoreTrendPoint => point.average !== null)
    .reverse()
}

interface ScoreTrendChartProps { entries: ScoreEntry[] }

export function ScoreTrendChart({ entries }: ScoreTrendChartProps) {
  const points = buildWeeklyScoreTrend(entries)
  if (points.length < 2) {
    return (
      <div style={styles.empty} role="status">
        {entries.length > 0 && points.length === 0
          ? "Your recent scores have aged out of the trend window. Score a new post to start a fresh trend."
          : "Your trend chart appears after you have scores in two separate weeks."}
      </div>
    )
  }
  const width = 320
  const height = 138
  const inset = { top: 18, right: 10, bottom: 28, left: 25 }
  const chartWidth = width - inset.left - inset.right
  const chartHeight = height - inset.top - inset.bottom
  const x = (index: number) => inset.left + (index / Math.max(points.length - 1, 1)) * chartWidth
  const y = (score: number) => inset.top + ((100 - score) / 100) * chartHeight
  const polyline = points.map((point, index) => `${x(index)},${y(point.average)}`).join(" ")

  return (
    <div style={styles.container} aria-label="Weekly PostPilot score trend">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" style={styles.chart}>
        <title>PostPilot score trend</title>
        {[0, 50, 100].map((score) => <g key={score}>
          <line x1={inset.left} x2={width - inset.right} y1={y(score)} y2={y(score)} style={styles.grid} />
          <text x={0} y={y(score) + 4} style={styles.axisLabel}>{score}</text>
        </g>)}
        <polyline points={polyline} fill="none" stroke="#1d9bf0" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point, index) => <circle key={point.timestamp} cx={x(index)} cy={y(point.average)} r="4" fill="#1d9bf0" stroke="#1e2024" strokeWidth="2">
          <title>{`${formatDate(point.timestamp)}: ${point.average} average from ${point.count} post${point.count === 1 ? "" : "s"}`}</title>
        </circle>)}
        <text x={inset.left} y={height - 7} style={styles.axisLabel}>{formatDate(points[0].timestamp)}</text>
        <text x={width - inset.right} y={height - 7} textAnchor="end" style={styles.axisLabel}>{formatDate(points[points.length - 1].timestamp)}</text>
        <text x={width - inset.right} y={11} textAnchor="end" style={styles.wordmark}>POSTPILOT</text>
      </svg>
      <div style={styles.caption}>Weekly average / local scores only</div>
    </div>
  )
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(timestamp)
}

const styles: Record<string, React.CSSProperties> = {
  container: { margin: "12px 0 8px" },
  chart: { display: "block", width: "100%", maxWidth: 420, height: "auto" },
  empty: { color: "#71767b", fontSize: 13, lineHeight: 1.5, margin: "12px 0 8px" },
  grid: { stroke: "#2f3336", strokeWidth: 1 },
  axisLabel: { fill: "#71767b", fontSize: 10, fontFamily: "system-ui, sans-serif" },
  wordmark: { fill: "#1d9bf0", fontSize: 11, fontWeight: 800, letterSpacing: 1.4, fontFamily: "system-ui, sans-serif" },
  caption: { color: "#71767b", fontSize: 11, marginTop: 2 }
}