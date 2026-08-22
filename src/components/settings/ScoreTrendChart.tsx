import React from "react"

import type { ScoreEntry } from "~history/score-history-storage"

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const WEEKS_TO_SHOW = 13

export interface ScoreTrendPoint {
  average: number
  count: number
  timestamp: number
}

export function buildWeeklyScoreTrend(entries: ScoreEntry[], now = Date.now()): ScoreTrendPoint[] {
  const currentWeekStart = new Date(now)
  currentWeekStart.setHours(0, 0, 0, 0)
  currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay())
  const start = currentWeekStart.getTime() - (WEEKS_TO_SHOW - 1) * WEEK_MS
  const buckets = new Map<number, ScoreEntry[]>()

  for (const entry of entries) {
    if (entry.timestamp < start || entry.timestamp > now) continue
    const date = new Date(entry.timestamp)
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - date.getDay())
    const weekStart = date.getTime()
    const bucket = buckets.get(weekStart) ?? []
    bucket.push(entry)
    buckets.set(weekStart, bucket)
  }

  return Array.from(buckets.entries()).sort(([a], [b]) => a - b).map(([timestamp, scores]) => ({
    timestamp,
    count: scores.length,
    average: Math.round(scores.reduce((sum, entry) => sum + entry.score, 0) / scores.length)
  }))
}

interface ScoreTrendChartProps { entries: ScoreEntry[] }

export function ScoreTrendChart({ entries }: ScoreTrendChartProps) {
  const points = buildWeeklyScoreTrend(entries)
  if (points.length < 2) return null
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
  grid: { stroke: "#2f3336", strokeWidth: 1 },
  axisLabel: { fill: "#71767b", fontSize: 10, fontFamily: "system-ui, sans-serif" },
  wordmark: { fill: "#1d9bf0", fontSize: 11, fontWeight: 800, letterSpacing: 1.4, fontFamily: "system-ui, sans-serif" },
  caption: { color: "#71767b", fontSize: 11, marginTop: 2 }
}
