import React, { useCallback, useEffect, useState } from "react"

import type { LearnedInsights } from "~learning/types"
import { loadCollectedPosts, loadLearnedInsights, clearAllLearningData } from "~learning/storage"
import { runLearningEngine } from "~learning/engine"
import { humanizeHookType } from "~scoring/hook-types"
import { getWeekStats, type WeekStats } from "~history/score-history-storage"

import { InsightCard } from "./InsightCard"
import { PerformanceChart } from "./PerformanceChart"

const UPGRADE_URL =
  "https://postpilotpro.lemonsqueezy.com/checkout/buy/40669ef5-0219-4b06-ac42-0d9cbdf7885f?discount=0"

interface AnalyticsTabProps {
  isPro: boolean
}

export function AnalyticsTab({ isPro }: AnalyticsTabProps) {
  const [insights, setInsights] = useState<LearnedInsights | null>(null)
  const [postCount, setPostCount] = useState(0)
  const [weekStats, setWeekStats] = useState<WeekStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState("")

  const loadData = useCallback(async () => {
    const [ins, posts, week] = await Promise.all([
      loadLearnedInsights(),
      loadCollectedPosts(),
      getWeekStats()
    ])
    setInsights(ins)
    setPostCount(posts.length)
    setWeekStats(week)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleRerun = useCallback(async () => {
    setLoading(true)
    setStatus("")
    try {
      const result = await runLearningEngine()
      setInsights(result)
      setStatus(
        result.isReady
          ? `Learning complete — ${result.postsAnalyzed} posts analyzed`
          : `Need ${20 - result.postsAnalyzed} more posts (have ${result.postsAnalyzed})`
      )
    } catch (err) {
      setStatus("Error running learning engine")
    }
    setLoading(false)
  }, [])

  const handleClear = useCallback(async () => {
    await clearAllLearningData()
    setInsights(null)
    setPostCount(0)
    setStatus("All learning data cleared")
  }, [])

  const fmtER = (er: number) => (er * 100).toFixed(3) + "%"

  return (
    <div>
      {/* Collection Status */}
      <InsightCard title="Collection Status">
        <div style={styles.row}>
          <span>Posts collected</span>
          <span style={styles.value}>{postCount}</span>
        </div>
        <div style={styles.row}>
          <span>Learning status</span>
          <span style={{
            ...styles.value,
            color: postCount >= 20 ? "#00ba7c" : "#f7b731"
          }}>
            {postCount >= 20 ? "Ready" : `${postCount}/20 posts needed`}
          </span>
        </div>
        {insights && (
          <>
            <div style={styles.row}>
              <span>Baseline ER</span>
              <span style={styles.value}>
                {fmtER(insights.baselineEngagementRate)}
              </span>
            </div>
            <div style={styles.row}>
              <span>Last updated</span>
              <span style={styles.valueMuted}>
                {new Date(insights.generatedAt).toLocaleString()}
              </span>
            </div>
            <div style={styles.row}>
              <span>Originals / replies</span>
              <span style={styles.valueMuted}>
                {insights.originalsAnalyzed} originals, {insights.repliesAnalyzed}{" "}
                replies
                {insights.unknownSegmentCount > 0
                  ? `, ${insights.unknownSegmentCount} unclassified`
                  : ""}
              </span>
            </div>
            <div style={styles.row}>
              <span>Scoring mode</span>
              <span style={styles.valueMuted}>
                {insights.segmentation === "segmented"
                  ? "Segmented (originals scored separately from replies)"
                  : "Blended (not enough originals yet to split)"}
              </span>
            </div>
          </>
        )}
        {!insights && postCount >= 20 && (
          <div style={styles.hint}>
            Click "Re-run Learning" to generate insights
          </div>
        )}
      </InsightCard>

      {/* Score Trends — free tier, mirrors the compose-panel's 7-day average */}
      {weekStats && weekStats.thisWeekCount > 0 && (
        <InsightCard title="Score Trends">
          <div style={styles.row}>
            <span>This week's average</span>
            <span style={{
              ...styles.value,
              color: weekStats.thisWeekAvg! >= 70 ? "#00ba7c" : weekStats.thisWeekAvg! >= 50 ? "#f7b731" : "#f4212e"
            }}>
              {weekStats.thisWeekAvg}
            </span>
          </div>
          <div style={styles.row}>
            <span>From</span>
            <span style={styles.valueMuted}>
              {weekStats.thisWeekCount} post{weekStats.thisWeekCount !== 1 ? "s" : ""}
            </span>
          </div>
          {weekStats.lastWeekAvg !== null && (
            <div style={styles.row}>
              <span>vs. last week</span>
              <span style={{
                ...styles.value,
                color:
                  weekStats.thisWeekAvg! - weekStats.lastWeekAvg > 2
                    ? "#00ba7c"
                    : weekStats.thisWeekAvg! - weekStats.lastWeekAvg < -2
                      ? "#f4212e"
                      : "#71767b"
              }}>
                {weekStats.thisWeekAvg! - weekStats.lastWeekAvg > 0 ? "+" : ""}
                {weekStats.thisWeekAvg! - weekStats.lastWeekAvg}
              </span>
            </div>
          )}
        </InsightCard>
      )}

      {/* Full breakdown teaser — shown to free users once there's enough data to unlock */}
      {!isPro && insights?.isReady && (
        <InsightCard title="Full Breakdown">
          <div style={styles.hint}>
            Hook performance, best posting times, media & topic impact, and
            reply craft — unlocked with Pro.
          </div>
          <div style={{ marginTop: 8 }}>
            <a
              href={UPGRADE_URL}
              target="_blank"
              rel="noreferrer"
              style={{ color: "#1d9bf0", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
              Upgrade to Pro →
            </a>
          </div>
        </InsightCard>
      )}

      {isPro && insights?.isReady && (
        <>
          {/* Hook Type Performance */}
          <InsightCard title="Hook Type Performance">
            <PerformanceChart
              bars={insights.hookTypePerformance.map((h) => ({
                label: humanizeHookType(h.hookType),
                value: h.boostMultiplier,
                count: h.postCount
              }))}
            />
          </InsightCard>

          {/* Length Sweet Spot */}
          <InsightCard title="Length Sweet Spot">
            <PerformanceChart
              bars={insights.lengthPerformance.map((l) => ({
                label: l.bucket + " chars",
                value: l.boostMultiplier,
                count: l.postCount
              }))}
            />
            {insights.optimalLengthRange && (
              <div style={{ ...styles.highlight, marginTop: 8 }}>
                Best range: {insights.optimalLengthRange.min}-
                {insights.optimalLengthRange.max} chars
              </div>
            )}
          </InsightCard>

          {/* Topic Performance */}
          <InsightCard title="Topic Performance">
            <PerformanceChart
              bars={insights.topicPerformance.slice(0, 10).map((t) => ({
                label: t.keyword,
                value: t.boostMultiplier,
                count: t.postCount
              }))}
            />
          </InsightCard>

          {/* Best Posting Times */}
          <InsightCard title="Best Posting Times — Weekdays">
            {insights.weekdayTimePerformance.length > 0 ? (
              <div style={styles.timeList}>
                {insights.weekdayTimePerformance.slice(0, 6).map((t) => (
                  <div key={t.hour} style={styles.row}>
                    <span>{formatHour(t.hour)}</span>
                    <span style={{
                      ...styles.value,
                      color: t.boostMultiplier >= 1.3 ? "#00ba7c" : "#e7e9ea"
                    }}>
                      {t.boostMultiplier.toFixed(1)}x ({t.postCount} posts)
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={styles.hint}>Not enough weekday data yet</div>
            )}
          </InsightCard>

          <InsightCard title="Best Posting Times — Weekends">
            {insights.weekendTimePerformance.length > 0 ? (
              <div style={styles.timeList}>
                {insights.weekendTimePerformance.slice(0, 6).map((t) => (
                  <div key={t.hour} style={styles.row}>
                    <span>{formatHour(t.hour)}</span>
                    <span style={{
                      ...styles.value,
                      color: t.boostMultiplier >= 1.3 ? "#00ba7c" : "#e7e9ea"
                    }}>
                      {t.boostMultiplier.toFixed(1)}x ({t.postCount} posts)
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={styles.hint}>Not enough weekend data yet</div>
            )}
          </InsightCard>

          <InsightCard title="Best Posting Times — All Days Combined">
            <div style={styles.hint}>
              Used as a fallback when there isn't enough weekday-only or weekend-only
              data yet. Blends every day of the week into one figure.
            </div>
            {insights.timePerformance.length > 0 ? (
              <div style={{ ...styles.timeList, marginTop: 6 }}>
                {insights.timePerformance.slice(0, 6).map((t) => (
                  <div key={t.hour} style={styles.row}>
                    <span>{formatHour(t.hour)}</span>
                    <span style={{
                      ...styles.value,
                      color: t.boostMultiplier >= 1.3 ? "#00ba7c" : "#e7e9ea"
                    }}>
                      {t.boostMultiplier.toFixed(1)}x ({t.postCount} posts)
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={styles.hint}>Not enough time data</div>
            )}
          </InsightCard>

          {/* Media Impact */}
          {insights.mediaPerformance && (
            <InsightCard title="Media Impact">
              <div style={styles.row}>
                <span>With image</span>
                <span style={styles.value}>
                  {fmtER(insights.mediaPerformance.withImage.avgER)} ({insights.mediaPerformance.withImage.postCount} posts)
                </span>
              </div>
              <div style={styles.row}>
                <span>Without image</span>
                <span style={styles.valueMuted}>
                  {fmtER(insights.mediaPerformance.withoutImage.avgER)} ({insights.mediaPerformance.withoutImage.postCount} posts)
                </span>
              </div>
              <div style={styles.row}>
                <span>Image boost</span>
                <span style={{
                  ...styles.value,
                  color: insights.mediaPerformance.imageBoost >= 1.5 ? "#00ba7c" : "#e7e9ea"
                }}>
                  {insights.mediaPerformance.imageBoost.toFixed(1)}x
                </span>
              </div>
              <div style={{ ...styles.row, marginTop: 6 }}>
                <span>With link</span>
                <span style={styles.value}>
                  {fmtER(insights.mediaPerformance.withLink.avgER)} ({insights.mediaPerformance.withLink.postCount} posts)
                </span>
              </div>
              <div style={styles.row}>
                <span>Without link</span>
                <span style={styles.valueMuted}>
                  {fmtER(insights.mediaPerformance.withoutLink.avgER)} ({insights.mediaPerformance.withoutLink.postCount} posts)
                </span>
              </div>
              <div style={styles.row}>
                <span>Link boost</span>
                <span style={styles.value}>
                  {insights.mediaPerformance.linkBoost.toFixed(1)}x
                </span>
              </div>
            </InsightCard>
          )}

          {/* Reply Craft */}
          {insights.replyInsights && (
            <InsightCard title="Reply Craft">
              <div style={styles.hint}>{insights.replyInsights.recommendation}</div>
              <div style={{ ...styles.row, marginTop: 8 }}>
                <span>Learned length band</span>
                <span style={styles.value}>
                  {insights.replyInsights.optimalLengthRange.min}-
                  {insights.replyInsights.optimalLengthRange.max} chars
                </span>
              </div>
              <div style={styles.row}>
                <span>Replies analyzed</span>
                <span style={styles.value}>
                  {insights.replyInsights.repliesAnalyzed}
                </span>
              </div>
              {insights.replyInsights.topExamples.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={styles.valueMuted}>Top replies</div>
                  {insights.replyInsights.topExamples.slice(0, 3).map((ex, i) => (
                    <div key={i} style={styles.rec}>
                      <span style={styles.recBadge}>
                        {(ex.er * 100).toFixed(1)}%
                      </span>
                      {ex.text}
                    </div>
                  ))}
                </div>
              )}
            </InsightCard>
          )}

          {/* Recommendations */}
          {insights.recommendations.length > 0 && (
            <InsightCard title="Recommendations">
              {insights.recommendations.map((rec, i) => (
                <div key={i} style={styles.rec}>
                  <span style={styles.recBadge}>
                    {rec.boostMultiplier.toFixed(1)}x
                  </span>
                  {rec.text}
                </div>
              ))}
            </InsightCard>
          )}
        </>
      )}

      {/* Actions */}
      <div style={styles.actions}>
        <button
          onClick={handleRerun}
          disabled={loading || postCount === 0}
          style={{
            ...styles.button,
            ...styles.primaryButton,
            opacity: loading || postCount === 0 ? 0.5 : 1
          }}>
          {loading ? "Running..." : "Re-run Learning"}
        </button>
        <button
          onClick={handleClear}
          style={styles.button}>
          Clear All Data
        </button>
      </div>

      {status && <p style={styles.status}>{status}</p>}
    </div>
  )
}

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM"
  if (hour === 12) return "12 PM"
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "3px 0",
    fontSize: 13
  },
  value: {
    color: "#1d9bf0",
    fontWeight: 600,
    fontSize: 13
  },
  valueMuted: {
    color: "#71767b",
    fontSize: 13
  },
  hint: {
    color: "#71767b",
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 6
  },
  highlight: {
    color: "#00ba7c",
    fontSize: 13,
    fontWeight: 600
  },
  timeList: {
    display: "flex",
    flexDirection: "column",
    gap: 2
  },
  rec: {
    fontSize: 13,
    color: "#e7e9ea",
    padding: "4px 0",
    display: "flex",
    alignItems: "center",
    gap: 8,
    lineHeight: 1.4
  },
  recBadge: {
    background: "rgba(0, 186, 124, 0.15)",
    color: "#00ba7c",
    padding: "2px 6px",
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 600,
    flexShrink: 0
  },
  actions: {
    display: "flex",
    gap: 8,
    marginTop: 16
  },
  button: {
    padding: "8px 16px",
    background: "#2f3336",
    border: "none",
    borderRadius: 8,
    color: "#e7e9ea",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer"
  },
  primaryButton: {
    background: "#1d9bf0",
    color: "#fff"
  },
  status: {
    fontSize: 13,
    color: "#1d9bf0",
    marginTop: 8
  }
}
