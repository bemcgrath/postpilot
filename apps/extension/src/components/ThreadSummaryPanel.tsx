import React, { useEffect, useRef, useState } from "react"

import { scorePost } from "@postpilot/core/scoring/scoring-pipeline"
import { loadFingerprint, loadVoiceOverrides } from "~scoring/voice-storage"
import { loadLearnedInsights } from "~learning/storage"
import type { LearnedInsights } from "@postpilot/core/learning/types"
import { validateStoredLicense } from "~config/license"
import { initConfig } from "@postpilot/core/config/config-storage"

interface TweetScore {
  index: number
  text: string
  score: number
}

function findThreadTexts(): string[] {
  const all = Array.from(
    document.querySelectorAll('[data-testid="tweetTextarea_0"]')
  )

  // Skip containers that are descendants of an earlier container (nested duplicates)
  const containers = all.filter(
    (el, i) => !all.slice(0, i).some((earlier) => earlier.contains(el))
  )

  return containers.map((el) => {
    // Prefer the contenteditable's full textContent (captures all Draft.js blocks)
    const editable = el.querySelector<HTMLElement>('[contenteditable="true"]')
    if (editable) return editable.textContent ?? ""
    // Fallback: join all data-text spans
    const spans = Array.from(el.querySelectorAll('[data-text="true"]'))
    return spans.length > 0
      ? spans.map((s) => s.textContent ?? "").join("")
      : el.textContent ?? ""
  })
}

function getStorage(): typeof chrome.storage.local | null {
  try {
    if (
      typeof chrome !== "undefined" &&
      chrome.runtime?.id &&
      typeof chrome.storage !== "undefined" &&
      typeof chrome.storage.local !== "undefined"
    ) {
      return chrome.storage.local
    }
  } catch {
    // Extension context invalidated or not available
  }
  return null
}

/** True on unpacked/dev-loaded builds (no update_url in the runtime manifest). */
function isDevBuild(): boolean {
  try {
    return !("update_url" in chrome.runtime.getManifest())
  } catch {
    return false
  }
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
  const overridesRef = useRef<Awaited<ReturnType<typeof loadVoiceOverrides>> | null>(null)
  const insightsRef = useRef<LearnedInsights | null>(null)

  useEffect(() => {
    initConfig().catch((err) => console.error("[PostPilot]", err))
    // Dev bypass, dev builds only (mirrors PostPilotPanel.tsx) -- devPro must
    // never be honored on a real Web Store build.
    validateStoredLicense().then((status) => {
      if (status.isActive) { setIsPro(true); return }
      if (!isDevBuild()) return
      const storage = getStorage()
      if (!storage) return
      storage.get("postpilot_dev_pro", (r) => {
        if (r.postpilot_dev_pro === true) setIsPro(true)
      })
    }).catch((err) => console.error("[PostPilot]", err))
    loadFingerprint().then(fp => { fingerprintRef.current = fp }).catch((err) => console.error("[PostPilot]", err))
    loadVoiceOverrides().then(ov => { overridesRef.current = ov }).catch((err) => console.error("[PostPilot]", err))
    loadLearnedInsights().then(ins => { insightsRef.current = ins }).catch((err) => console.error("[PostPilot]", err))
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
      const insights = isPro ? insightsRef.current : null
      const boosts = insights?.isReady ? insights.hookTypeBoosts : undefined
      const lengthRange = insights?.isReady ? insights.optimalLengthRange : null

      const updated = texts.map((text, i) => ({
        index: i + 1,
        text,
        score: text.length >= 2
          ? scorePost(text, fp, boosts, ov, {
              originalLengthRange: lengthRange
            }).hookScore.totalScore
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
