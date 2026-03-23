import React, { useCallback, useEffect, useRef, useState } from "react"

import type { PostScore } from "~scoring/types"
import type { VoiceFingerprint } from "~scoring/voice-types"
import type { LearnedInsights } from "~learning/types"

import { scorePost } from "~scoring/scoring-pipeline"
import { loadFingerprint } from "~scoring/voice-storage"
import { loadLearnedInsights } from "~learning/storage"
import { initConfig, onConfigChanged } from "~config/config-storage"

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
  const [insights, setInsights] = useState<LearnedInsights | null>(null)
  const [configRevision, setConfigRevision] = useState(0)

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

  if (!enabled || !text || text.length < 2) return null

  // configRevision forces re-render when config changes, scorePost reads updated config
  void configRevision
  const hookTypeBoosts = insights?.isReady ? insights.hookTypeBoosts : undefined
  const result: PostScore = scorePost(text, fingerprint, hookTypeBoosts)
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
        {result.voiceMatch && (
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
        <span className="postpilot-logo">PostPilot</span>
      </div>

      {expanded && (
        <div className="postpilot-details">
          <ScoreBreakdown
            breakdown={result.hookScore.breakdown}
            suggestions={result.hookScore.suggestions}
          />
          <GovernorWarnings issues={result.governor.issues} />
          {result.voiceMatch && (
            <VoiceMatchBreakdown voiceMatch={result.voiceMatch} />
          )}
          {insights?.isReady && (
            <InsightsPanel
              insights={insights}
              currentHookType={result.hookScore.hookType}
            />
          )}
        </div>
      )}
    </div>
  )
}
