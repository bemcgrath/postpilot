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
import { HookLibrary } from "./HookLibrary"
import { saveScoreEntry, getWeekStats } from "~history/score-history-storage"
import type { WeekStats } from "~history/score-history-storage"
import { loadDrafts, saveDraft, deleteDraft } from "~drafts/draft-storage"
import type { DraftEntry } from "~drafts/draft-storage"
import { loadHooks, saveHook, deleteHook } from "~hooks/hook-storage"
import type { HookEntry } from "~hooks/hook-storage"

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

function findNearestContentEditable(
  panelEl: HTMLElement | null
): HTMLElement | null {
  if (panelEl) {
    let host: Element | null = panelEl
    const root = panelEl.getRootNode()
    if (root instanceof ShadowRoot) host = root.host
    if (host) {
      let container = host.parentElement
      for (let i = 0; i < 5 && container; i++) {
        const el = container.querySelector<HTMLElement>(
          '[data-testid="tweetTextarea_0"] [contenteditable="true"]'
        ) ?? container.querySelector<HTMLElement>(
          '[data-testid="tweetTextarea_0"]'
        )
        if (el) return el
        container = container.parentElement
      }
    }
    // This panel's own compose box is gone — never inject into a different
    // compose box elsewhere on the page (e.g. a reply modal's).
    return null
  }
  return document.querySelector<HTMLElement>(
    '[data-testid="tweetTextarea_0"] [contenteditable="true"]'
  ) ?? document.querySelector<HTMLElement>(
    '[data-testid="tweetTextarea_0"]'
  )
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
    // This panel's own compose box is gone. Never fall back to another
    // compose box on the page: when a reply modal is open, the background
    // panel would mirror the modal's text, and its mounting/unmounting
    // shifts the whole timeline behind the dialog (~58px bounce). It also
    // caused duplicate auto-saves of the same hook from multiple panels.
    return null
  }

  // Fallback: global search (only before the ref is attached on first render)
  return document.querySelector<HTMLElement>(
    'div[data-testid="tweetTextarea_0"] [data-text="true"]'
  ) ?? document.querySelector<HTMLElement>(
    'div[data-testid="tweetTextarea_0"]'
  )
}

function injectText(panelEl: HTMLElement | null, newText: string) {
  const editable = findNearestContentEditable(panelEl)
  if (!editable) return

  editable.click()
  setTimeout(() => {
    // Set DOM selection to cover all content in the compose box
    const sel = window.getSelection()
    if (sel) {
      const range = document.createRange()
      range.selectNodeContents(editable)
      sel.removeAllRanges()
      sel.addRange(range)
    }
    // Replace the selection with new text
    document.execCommand("insertText", false, newText)
    // Refocus after execCommand so Draft.js re-establishes its cursor state
    setTimeout(() => editable.focus(), 50)
  }, 20)
}

/**
 * Poll the host page's compose box for text changes.
 * Polling is more reliable than MutationObserver on X.com's
 * Draft.js contenteditable which mutates deeply nested spans.
 * Scoped to the nearest compose box via the panel's DOM ref.
 */
function useComposeText(panelRef: React.RefObject<HTMLElement | null>): [string, () => void] {
  const [text, setText] = useState("")
  const lastTextRef = useRef("")

  const readNow = useCallback(() => {
    const composeBox = findNearestComposeBox(panelRef.current)
    const raw = composeBox?.textContent ?? ""
    if (raw !== lastTextRef.current) {
      lastTextRef.current = raw
      setText(raw)
    }
  }, [panelRef])

  useEffect(() => {
    const interval = setInterval(readNow, 200)

    return () => clearInterval(interval)
  }, [readNow])

  return [text, readNow]
}

export function PostPilotPanel() {
  const panelRef = useRef<HTMLDivElement>(null)
  const [text, readTextNow] = useComposeText(panelRef)
  const [expanded, setExpanded] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [fingerprint, setFingerprint] = useState<VoiceFingerprint | null>(null)
  const [overrides, setOverrides] = useState<VoiceOverrides | null>(null)
  const [insights, setInsights] = useState<LearnedInsights | null>(null)
  const [configRevision, setConfigRevision] = useState(0)
  const [isPro, setIsPro] = useState(false)
  const [weekStats, setWeekStats] = useState<WeekStats | null>(null)
  const [drafts, setDrafts] = useState<DraftEntry[]>([])
  const [hooks, setHooks] = useState<HookEntry[]>([])
  const [savedMsg, setSavedMsg] = useState(false)
  const [hookSavedMsg, setHookSavedMsg] = useState(false)
  const lastScoreRef = useRef<number>(0)
  const prevTextRef = useRef<string>("")
  const lastSavedAtRef = useRef<number>(0)
  const pendingClearRef = useRef<{ prev: string; score: number; timer: number } | null>(null)
  const isProRef = useRef(isPro)
  isProRef.current = isPro

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

  // Check Pro license status on mount (dev bypass: set postpilot_dev_pro=true in storage)
  useEffect(() => {
    validateStoredLicense().then((status) => {
      if (status.isActive) { setIsPro(true); return }
      const storage = getStorage()
      if (!storage) return
      storage.get("postpilot_dev_pro", (r) => {
        if (r.postpilot_dev_pro === true) setIsPro(true)
      })
    }).catch(() => {})
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

  const commitClearSave = useCallback((prev: string, score: number, pro: boolean) => {
    lastSavedAtRef.current = Date.now()
    saveScoreEntry(score).then(() => {
      getWeekStats().then(setWeekStats).catch(() => {})
    }).catch(() => {})
    if (pro && score >= 70) {
      saveHook(prev, null, score, "auto").then((entry) => {
        setHooks((h) => [entry, ...h.filter((x) => x.id !== entry.id)].slice(0, 50))
      }).catch(() => {})
    }
  }, [])

  // Detect compose box clearing after substantial text — record score + auto-save hook.
  // Draft.js re-renders can make the compose box read as empty for a poll tick,
  // so the save is deferred: if text reappears the pending save is discarded.
  useEffect(() => {
    if (pendingClearRef.current) {
      window.clearTimeout(pendingClearRef.current.timer)
      pendingClearRef.current = null
    }
    const prev = prevTextRef.current
    prevTextRef.current = text
    if (
      text.length < 2 &&
      prev.length >= 20 &&
      lastScoreRef.current > 0 &&
      Date.now() - lastSavedAtRef.current > 30_000
    ) {
      const score = lastScoreRef.current
      const timer = window.setTimeout(() => {
        pendingClearRef.current = null
        commitClearSave(prev, score, isPro)
      }, 600)
      pendingClearRef.current = { prev, score, timer }
    }
  }, [text, isPro, commitClearSave])

  // If the panel unmounts while a clear-save is pending (reply modal closes
  // right after posting), flush it so the post still gets recorded.
  useEffect(() => {
    return () => {
      const pending = pendingClearRef.current
      if (pending) {
        window.clearTimeout(pending.timer)
        pendingClearRef.current = null
        commitClearSave(pending.prev, pending.score, isProRef.current)
      }
    }
  }, [commitClearSave])

  // Load week stats, drafts, and hooks on mount; keep in sync with storage changes
  useEffect(() => {
    getWeekStats().then(setWeekStats).catch(() => {})
    loadDrafts().then(setDrafts).catch(() => {})
    loadHooks().then(setHooks).catch(() => {})

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
        if ("postpilot_hook_library" in changes) {
          setHooks((changes.postpilot_hook_library.newValue as HookEntry[]) ?? [])
        }
      } catch {}
    }
    storage.onChanged.addListener(listener)
    return () => { try { storage.onChanged.removeListener(listener) } catch {} }
  }, [])

  if (!enabled) return null
  // Keep the ref'd root mounted (zero-height) even when there's nothing to
  // show: the ref anchors the scoped compose-box lookup. If it unmounted,
  // the next poll would run ref-less with the global fallback and could pick
  // up a different compose box's text (e.g. an open reply modal's), making
  // the panel oscillate mount/unmount and bounce the page behind the modal.
  if (!text || text.length < 2) {
    return <div className="postpilot-root" ref={panelRef} />
  }

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

  function handleSaveHook() {
    saveHook(text, result.hookScore.hookType, result.hookScore.totalScore, "manual")
      .then((entry) => {
        setHooks((prev) => [entry, ...prev.filter((h) => h.id !== entry.id)].slice(0, 50))
        setHookSavedMsg(true)
        setTimeout(() => setHookSavedMsg(false), 1500)
      })
      .catch(() => {})
  }

  function handleRestoreDraft(draft: DraftEntry) {
    setTimeout(() => injectText(panelRef.current, draft.text), 10)
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
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              className={`postpilot-save-btn${savedMsg ? " postpilot-save-btn--saved" : ""}`}
              onClick={handleSaveDraft}>
              {savedMsg ? "Saved!" : "Save draft"}
            </button>
            {isPro && result.hookScore.totalScore >= 70 && (
              <button
                className={`postpilot-save-btn${hookSavedMsg ? " postpilot-save-btn--saved" : ""}`}
                onClick={handleSaveHook}>
                {hookSavedMsg ? "Saved!" : "Save hook"}
              </button>
            )}
          </div>
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
              fingerprint={proFingerprint}
              overrides={proOverrides}
              hookTypeBoosts={hookTypeBoosts}
              onReplace={(newText) => {
                setTimeout(() => {
                  injectText(panelRef.current, newText)
                  setTimeout(readTextNow, 300)
                }, 10)
              }}
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
          {isPro && hooks.length > 0 && (
            <HookLibrary
              hooks={hooks}
              onUse={(entry) => setTimeout(() => injectText(panelRef.current, entry.fullText), 10)}
              onDelete={(id) => {
                deleteHook(id).then(() => setHooks((prev) => prev.filter((h) => h.id !== id))).catch(() => {})
              }}
            />
          )}
          {!isPro && (
            <div style={{ padding: "8px 12px", fontSize: "12px", color: "#888", borderTop: "1px solid #eee", marginTop: "4px" }}>
              <a href="https://postpilotpro.lemonsqueezy.com/checkout/buy/40669ef5-0219-4b06-ac42-0d9cbdf7885f?discount=0" target="_blank" rel="noreferrer" style={{ color: "#1d9bf0", textDecoration: "none" }}>
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
