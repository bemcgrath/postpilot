export interface HourPerformance {
  hour: number
  postCount: number
  boostMultiplier: number
}

export interface TimingInsights {
  timePerformance: HourPerformance[]
  weekdayTimePerformance: HourPerformance[]
  weekendTimePerformance: HourPerformance[]
}

export interface PostingTimeVerdict {
  nowGood: boolean
  label: string
}

function fmtHour(h: number): string {
  if (h === 0) return "12 AM"
  if (h < 12) return `${h} AM`
  if (h === 12) return "12 PM"
  return `${h - 12} PM`
}

export function getBestTimeLabel(timePerformance: HourPerformance[]): string | null {
  const candidates = timePerformance.filter((t) => t.postCount >= 3)
  if (candidates.length === 0) return null
  const best = candidates.reduce((a, b) =>
    a.boostMultiplier > b.boostMultiplier ? a : b
  )
  if (best.boostMultiplier < 1.1) return null
  const end = (best.hour + 2) % 24
  return `${fmtHour(best.hour)}–${fmtHour(end)}`
}

export function todaysTimePerformance(
  insights: TimingInsights,
  now = new Date()
): HourPerformance[] {
  const day = now.getDay()
  const todays =
    day === 0 || day === 6
      ? insights.weekendTimePerformance
      : insights.weekdayTimePerformance
  return todays.length > 0 ? todays : insights.timePerformance
}

/**
 * "Is now a good time?" vs the user's learned hours.
 * Returns null when there isn't enough time data to be honest.
 */
export function evaluatePostingTime(
  insights: TimingInsights,
  now = new Date()
): PostingTimeVerdict | null {
  const series = todaysTimePerformance(insights, now)
  const bestLabel = getBestTimeLabel(series) ?? getBestTimeLabel(insights.timePerformance)
  if (!bestLabel) return null

  const hour = now.getHours()
  const current = series.find((t) => t.hour === hour)
  const nowGood =
    !!current && current.postCount >= 3 && current.boostMultiplier >= 1.1

  return {
    nowGood,
    label: nowGood ? "Now's a good time" : `Better at ${bestLabel}`
  }
}
