import React, { useEffect, useRef, useState } from "react"

import { scorePost } from "~scoring/scoring-pipeline"
import { loadFingerprint, loadVoiceOverrides } from "~scoring/voice-storage"
import { validateStoredLicense } from "~config/license"
import { initConfig } from "~config/config-storage"

interface TweetScore {
  index: number
  text: string
  score: number
}

function findThreadTexts(): string[] {
  // Each tweet in a thread has its own tweetTextarea_0 — query all in document order
  const containers = Array.from(
    document.querySelectorAll('[data-testid="tweetTextarea_0"]')
  )
  return containers.map((el) => {
    const textNode = el.querySelector('[data-text="true"]')
    return textNode?.textContent ?? el.textContent ?? ""
  })
}

function scoreColor(score: number): string {
  if (score >= 70) return "#00ba7c"
  if (score >= 50) return "#f7b731"
  return "#f4212e"
}

export function ThreadSummaryPanel() {
  const [scores, setScores] = useState<TweetScore[]>([])
  const [isPro, setIsPro] = useState(false)
  const fingerprintRef = useRef<Awaited<ReturnType<typeof loadFingerprint>>>(null)
  const overridesRef = useRef<Awaited<ReturnType<typeof loadVoiceOverrides>>>(null)

  useEffect(() => {
    try { initConfig() } catch {}
    validateStoredLicense().then(s => setIsPro(s.isActive)).catch(() => {})
    loadFingerprint().then(fp => { fingerprintRef.current = fp }).catch(() => {})
    loadVoiceOverrides().then(ov => { overridesRef.current = ov }).catch(() => {})
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      const texts = findThreadTexts()
      if (texts.length < 2) {
        setScores([])
        return
      }

      const fp = isPro ? fingerprintRef.current : null
      const ov = isPro ? overridesRef.current : null

      const updated = texts.map((text, i) => ({
        index: i + 1,
        text,
        score: text.length >= 2
          ? scorePost(text, fp, undefined, ov).hookScore.totalScore
          : 0,
      }))
      setScores(updated)
    }, 600)

    return () => clearInterval(interval)
  }, [isPro])

  const activeTweets = scores.filter(s => s.text.length >= 2)
  if (activeTweets.length < 2) return null

  const avg = Math.round(
    activeTweets.reduce((sum, s) => sum + s.score, 0) / activeTweets.length
  )
  const weakest = activeTweets.reduce((a, b) => a.score < b.score ? a : b)
  const totalChars = activeTweets.reduce((sum, s) => sum + s.text.length, 0)

  return (
    <div className="postpilot-thread">
      <div className="postpilot-thread__header">
        <span className="postpilot-thread__label">Thread</span>
        <span className="postpilot-thread__stat">{activeTweets.length} tweets</span>
        <span className="postpilot-thread__stat">{totalChars} chars</span>
        <span className="postpilot-thread__stat">
          Avg{" "}
          <span style={{ color: scoreColor(avg), fontWeight: 700 }}>{avg}</span>
        </span>
        {weakest.score < 60 && (
          <span className="postpilot-thread__weak">
            Tweet {weakest.index} is weakest
          </span>
        )}
      </div>
      <div className="postpilot-thread__scores">
        {scores.map((s) => (
          <span
            key={s.index}
            className="postpilot-thread__chip"
            style={{
              color: s.text.length >= 2 ? scoreColor(s.score) : "#536471",
              borderColor: s.text.length >= 2 ? scoreColor(s.score) : "#2f3336",
              opacity: s === weakest && weakest.score < 60 ? 1 : 0.85,
            }}>
            T{s.index}: {s.text.length >= 2 ? s.score : "—"}
          </span>
        ))}
      </div>
    </div>
  )
}
