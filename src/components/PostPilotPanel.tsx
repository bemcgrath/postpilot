import React, { useCallback, useEffect, useRef, useState } from "react"

import type { PostScore } from "~scoring/types"
import type { VoiceFingerprint, VoiceOverrides } from "~scoring/voice-types"
import type { LearnedInsights } from "~learning/types"

import { scorePost } from "~scoring/scoring-pipeline"
import { loadFingerprint, loadVoiceOverrides } from "~scoring/voice-storage"
import { loadLearnedInsights } from "~learning/storage"
import { initConfig, onConfigChanged } from "~config/config-storage"
import { validateStoredLicense } from "~config/license"

/** Safely access chrome.storage.local — returns null if unavailable or context invalidated. */
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

import { CharacterCount } from "./CharacterCount"
import { GovernorWarnings } from "./GovernorWarnings"
import { HookTypeLabel } from "./HookTypeLabel"
import { ScoreBadge } from "./ScoreBadge"
import { ScoreBreakdown } from "./ScoreBreakdown"
import { VoiceMatchBadge } from "./VoiceMatchBadge"
import { VoiceMatchBreakdown } from "./VoiceMatchBreakdown"
import { InsightsPanel } from "./InsightsPanel"
import { RewriteSuggestions } from "./RewriteSuggestions"
import { ScoreHistoryBadge } from "./ScoreHistoryBadge"
import { DraftQueue } from "./DraftQueue"
import { saveScoreEntry, getWeekStats } from "~history/score-history-storage"
import type { WeekStats } from "~history/score-history-storage"
import { loadDrafts, saveDraft, deleteDraft } from "~drafts/draft-storage"
import type { DraftEntry } from "~drafts/draft-storage"

function fmtHour(h: number): string {
  if (h === 0) return "12 AM"
  if (h < 12) return `${h} AM`
  if (h === 12) return "12 PM"
  return `${h - 12} PM`
}

function getBestTimeLabel(
  timePerformance: Array<{ hour: number; postCount: number; boostMultiplier: number }>
): string | null {
  const candidates = timePerformance.filter((t) => t.postCount >= 3)
  if (candidates.length === 0) return null
  const best = candidates.reduce((a, b) =>
    a.boostMultiplier > b.boostMultiplier ? a : b
  )
  if (best.boostMultiplier < 1.1) return null
  const end = (best.hour + 2) % 24
  return `${fmtHour(best.hour)}–${fmtHour(end)}`
}

/**
 * Find the compose box associated with this panel instance.
 * The panel is injected inside a <plasmo-csui> shadow host, placed afterend
 * of a [data-testid="toolBar"]. Walk from the shadow host up to the nearest
 * container that holds both the toolbar and the textarea.
 */
function findNearestComposeBox(
  panelEl: HTMLElement | null
): HTMLElement | null {
  // If we have a ref, try scoped search first (for reply compose boxes)
  if (panelEl) {
    let host: Element | null = panelEl
    const root = panelEl.getRootNode()
    if (root instanceof ShadowRoot) {
      host = root.host
    }
    if (host) {
      let container = host.parentElement
      for (let i = 0; i < 5 && container; i++) {
        const textarea = container.querySelector<HTMLElement>(
          'div[data-testid="tweetTextarea_0"] [data-text="true"]'
        ) ?? container.querySelector<HTMLElement>(
          'div[data-testid="tweetTextarea_0"]'
        )
        if (textarea) return textarea
        container = container.parentElement
      }
    }
  }

  // Fallback: global search (always works, needed before ref is attached)
  return document.querySelector<HTMLElement>(
    'div[data-testid="tweetTextarea_0"] [data-text="true"]'
  ) ?? document.querySelector<HTMLElement>(
    'div[data-testid="tweetTextarea_0"]'
  )
}

/**
 * Poll the host page's compose box for text changes.
 * Polling is more reliable than MutationObserver on X.com's
 * Draft.js contenteditable which mutates deeply nested spans.
 * Scoped to the nearest compose box via the panel's DOM ref.
 */
function useComposeText(panelRef: React.RefObject<HTMLElement | null>): string {
  const [text, setText] = useState("")
  const lastTextRef = useRef("")

  useEffect(() => {
    const interval = setInterval(() => {
      const composeBox = findNearestComposeBox(panelRef.current)
      const raw = composeBox?.textContent ?? ""
      if (raw !== lastTextRef.current) {
        lastTextRef.current = raw
        setText(raw)
      }
    }, 500)

    return () => clearInterval(interval)
  }, [panelRef])

  return text
}

export function PostPilotPanel() {
  const panelRef = useRef<HTMLDivElement>(null)
  const text = useComposeText(panelRef)
  const [expanded, setExpanded] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [fingerprint, setFingerprint] = useState<VoiceFingerprint | null>(null)
  const [overrides, setOverrides] = useState<VoiceOverrides | null>(null)
  const [insights, setInsights] = useState<LearnedInsights | null>(null)
  const [configRevision, setConfigRevision] = useState(0)
  const [isPro, setIsPro] = useState(false)
  const [weekStats, setWeekStats] = useState<WeekStats | null>(null)
  const [drafts, setDrafts] = useState<DraftEntry[]>([])
  const [savedMsg, setSavedMsg] = useState(false)
  const lastScoreRef = useRef<number>(0)
  const prevTextRef = useRef<string>("")

  // Initialize config on mount and listen for config changes
  useEffect(() => {
    try {
      initConfig()
    } catch {
      // Extension context may be invalidated
    }
    const unsubscribe = onConfigChanged(() => {
      setConfigRevision((r) => r + 1)
    })
    return unsubscribe
  }, [])

  // Check Pro license status on mount
  useEffect(() => {
    validateStoredLicense().then((status) => setIsPro(status.isActive)).catch(() => {})
  }, [])

  // Read enabled state from storage (safely — may not be available in CSUI)
  useEffect(() => {
    const storage = getStorage()
    if (!storage) return

    storage.get("postpilot_enabled", (result: Record<string, unknown>) => {
      try {
        if (result && result.postpilot_enabled === false) {
          setEnabled(false)
        }
      } catch {}
    })

    const listener = (changes: Record<string, { newValue?: unknown }>) => {
      try {
        if ("postpilot_enabled" in changes) {
          setEnabled(changes.postpilot_enabled.newValue !== false)
        }
      } catch {}
    }
    storage.onChanged.addListener(listener)
    return () => { try { storage.onChanged.removeListener(listener) } catch {} }
  }, [])

  // Load voice fingerprint from storage
  useEffect(() => {
    loadFingerprint().then(setFingerprint).catch(() => {})

    const storage = getStorage()
    if (!storage) return

    const listener = (changes: Record<string, { newValue?: unknown }>) => {
      try {
        if ("postpilot_voice_fingerprint" in changes) {
          setFingerprint(
            (changes.postpilot_voice_fingerprint.newValue as VoiceFingerprint) ?? null
          )
        }
      } catch {}
    }
    storage.onChanged.addListener(listener)
    return () => { try { storage.onChanged.removeListener(listener) } catch {} }
  }, [])

  // Load voice overrides from storage
  useEffect(() => {
    loadVoiceOverrides().then(setOverrides).catch(() => {})

    const storage = getStorage()
    if (!storage) return

    const listener = (changes: Record<string, { newValue?: unknown }>) => {
      try {
        if ("postpilot_voice_overrides" in changes) {
          setOverrides(
            (changes.postpilot_voice_overrides.newValue as VoiceOverrides) ?? null
          )
        }
      } catch {}
    }
    storage.onChanged.addListener(listener)
    return () => { try { storage.onChanged.removeListener(listener) } catch {} }
  }, [])

  // Load learned insights from storage
  useEffect(() => {
    loadLearnedInsights().then(setInsights).catch(() => {})

    const storage = getStorage()
    if (!storage) return

    const listener = (changes: Record<string, { newValue?: unknown }>) => {
      try {
        if ("postpilot_learned_insights" in changes) {
          setInsights(
            (changes.postpilot_learned_insights.newValue as LearnedInsights) ?? null
          )
        }
      } catch {}
    }
    storage.onChanged.addListener(listener)
    return () => { try { storage.onChanged.removeListener(listener) } catch {} }
  }, [])

  // Detect compose box clearing after substantial text — record the score
  useEffect(() => {
    const prev = prevTextRef.current
    prevTextRef.current = text
    if (text.length < 2 && prev.length >= 20 && lastScoreRef.current > 0) {
      saveScoreEntry(lastScoreRef.current).then(() => {
        getWeekStats().then(setWeekStats).catch(() => {})
      }).catch(() => {})
    }
  }, [text])

  // Load week stats and drafts on mount; keep in sync with storage changes
  useEffect(() => {
    getWeekStats().then(setWeekStats).catch(() => {})
    loadDrafts().then(setDrafts).catch(() => {})

    const storage = getStorage()
    if (!storage) return
    const listener = (changes: Record<string, { newValue?: unknown }>) => {
      try {
        if ("postpilot_score_history" in changes) {
          getWeekStats().then(setWeekStats).catch(() => {})
        }
        if ("postpilot_drafts" in changes) {
          setDrafts((changes.postpilot_drafts.newValue as DraftEntry[]) ?? [])
        }
      } catch {}
    }
    storage.onChanged.addListener(listener)
    return () => { try { storage.onChanged.removeListener(listener) } catch {} }
  }, [])

  if (!enabled || !text || text.length < 2) return null

  // configRevision forces re-render when config changes, scorePost reads updated config
  void configRevision
  const proFingerprint = isPro ? fingerprint : null
  const proOverrides = isPro ? overrides : null
  const hookTypeBoosts = isPro && insights?.isReady ? insights.hookTypeBoosts : undefined
  const result: PostScore = scorePost(text, proFingerprint, hookTypeBoosts, proOverrides)
  lastScoreRef.current = result.hookScore.totalScore

  function handleSaveDraft() {
    saveDraft(text, result.hookScore.totalScore, result.hookScore.hookType)
      .then((entry) => {
        setDrafts((prev) => [entry, ...prev].slice(0, 20))
        setSavedMsg(true)
        setTimeout(() => setSavedMsg(false), 1500)
      })
      .catch(() => {})
  }

  function handleRestoreDraft(draft: DraftEntry) {
    const box = findNearestComposeBox(panelRef.current)
    if (!box) return
    box.focus()
    document.execCommand("selectAll", false)
    document.execCommand("insertText", false, draft.text)
  }

  function handleDeleteDraft(id: string) {
    deleteDraft(id).then(() => {
      setDrafts((prev) => prev.filter((d) => d.id !== id))
    }).catch(() => {})
  }

  const errorCount = result.governor.issues.filter(
    (i) => i.severity === "error"
  ).length
  const warningCount = result.governor.issues.filter(
    (i) => i.severity === "warning"
  ).length
  const totalIssues = errorCount + warningCount

  return (
    <div className="postpilot-root" ref={panelRef}>
      <div
        className="postpilot-bar"
        onClick={() => setExpanded(!expanded)}
        style={
          expanded ? { borderRadius: "12px 12px 0 0" } : undefined
        }>
        <ScoreBadge score={result.hookScore.totalScore} />
        <HookTypeLabel hookType={result.hookScore.hookType} />
        <CharacterCount
          count={result.charCount}
          inSweetSpot={result.inSweetSpot}
        />
        {isPro && result.voiceMatch && (
          <VoiceMatchBadge voiceMatch={result.voiceMatch} />
        )}
        {totalIssues > 0 && (
          <span
            className={`postpilot-warning-count ${
              errorCount > 0
                ? "postpilot-warning-count--errors"
                : "postpilot-warning-count--warnings"
            }`}>
            {totalIssues} {totalIssues === 1 ? "issue" : "issues"}
          </span>
        )}
        {isPro && insights?.isReady && (() => {
          const label = getBestTimeLabel(insights.timePerformance)
          return label ? (
            <span className="postpilot-best-time">Best: {label}</span>
          ) : null
        })()}
        {drafts.length > 0 && (
          <span className="postpilot-drafts-count">
            {drafts.length} draft{drafts.length !== 1 ? "s" : ""}
          </span>
        )}
        <span className="postpilot-logo">PostPilot</span>
      </div>

      {expanded && (
        <div className="postpilot-details">
          <button
            className={`postpilot-save-btn${savedMsg ? " postpilot-save-btn--saved" : ""}`}
            onClick={handleSaveDraft}>
            {savedMsg ? "Saved!" : "Save draft"}
          </button>
          <ScoreBreakdown
            breakdown={result.hookScore.breakdown}
            suggestions={result.hookScore.suggestions}
          />
          <GovernorWarnings issues={result.governor.issues} />
          {result.hookScore.totalScore < 65 && (
            <RewriteSuggestions
              originalText={text}
              score={result}
              isPro={isPro}
            />
          )}
          {weekStats && <ScoreHistoryBadge stats={weekStats} />}
          {isPro && result.voiceMatch && (
            <VoiceMatchBreakdown voiceMatch={result.voiceMatch} />
          )}
          {isPro && insights?.isReady && (
            <InsightsPanel
              insights={insights}
              currentHookType={result.hookScore.hookType}
            />
          )}
          <DraftQueue
            drafts={drafts}
            onRestore={handleRestoreDraft}
            onDelete={handleDeleteDraft}
          />
          {!isPro && (
            <div style={{ padding: "8px 12px", fontSize: "12px", color: "#888", borderTop: "1px solid #eee", marginTop: "4px" }}>
              <a href="https://postpilotpro.lemonsqueezy.com/checkout/buy/921ab388-2b1b-44e0-afd7-54da993317d0?discount=0" target="_blank" rel="noreferrer" style={{ color: "#1d9bf0", textDecoration: "none" }}>
                Upgrade to PostPilot Pro
              </a>
              {" "}for voice fingerprinting &amp; learning engine
            </div>
          )}
        </div>
      )}
    </div>
  )
}
