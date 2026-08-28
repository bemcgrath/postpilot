import React, { useCallback, useEffect, useRef, useState } from "react"

import type { PostScore } from "@postpilot/core/scoring/types"
import type { VoiceFingerprint, VoiceOverrides } from "@postpilot/core/scoring/voice-types"
import { STORAGE_KEYS, type LearnedInsights } from "@postpilot/core/learning/types"
import type { CollectionFunnelSnapshot } from "@postpilot/core/learning/funnel"
import type { ComposerKind } from "@postpilot/core/scoring/reply-context"

import { scorePost } from "@postpilot/core/scoring/scoring-pipeline"
import type { ScoreContext } from "@postpilot/core/scoring/scoring-pipeline"
import { detectComposerKind, readParentTweetText } from "~dom/reply-context"
import { loadFingerprint, loadVoiceOverrides } from "~scoring/voice-storage"
import { loadLearnedInsights, loadFunnelSnapshot, loadCollectedPosts } from "~learning/storage"
import type { CollectedPost } from "@postpilot/core/learning/types"
import { estimateReachRange, formatReach } from "@postpilot/core/learning/reach"
import { evaluatePostingTime } from "@postpilot/core/scoring/timing"
import { detectComposeMedia } from "~dom/compose-media"
import { buildPrePublishChecklist } from "@postpilot/core/scoring/checklist"
import { scoreReplyInvite } from "@postpilot/core/scoring/reply-invite"
import { suggestSelfReply } from "@postpilot/core/scoring/self-reply"
import { EMPTY_MEDIA } from "@postpilot/core/scoring/media-delta"
import { initConfig, onConfigChanged } from "@postpilot/core/config/config-storage"
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

/** True on unpacked/dev-loaded builds (no update_url in the runtime manifest). */
function isDevBuild(): boolean {
  try {
    return !("update_url" in chrome.runtime.getManifest())
  } catch {
    return false
  }
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
import { PrePublishChecklist } from "./PrePublishChecklist"
import { SelfReplyPrompt } from "./SelfReplyPrompt"
import { saveScoreEntry, getWeekStats } from "~history/score-history-storage"
import type { WeekStats } from "~history/score-history-storage"
import { loadDrafts, saveDraft, deleteDraft } from "~drafts/draft-storage"
import { ReviewPrompt } from "./ReviewPrompt"
import { recordHighScorePost, shouldShowPrompt } from "~review/review-prompt-storage"
import type { DraftEntry } from "~drafts/draft-storage"
import { loadHooks, saveHook, deleteHook } from "~hooks/hook-storage"
import type { HookEntry } from "~hooks/hook-storage"

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

interface ComposeContext {
  container: HTMLElement
  textarea: HTMLElement
}

/**
 * Find the compose box associated with this panel instance, and the scoped
 * ancestor container it was found in. The panel is injected inside a
 * <plasmo-csui> shadow host, placed afterend of a [data-testid="toolBar"].
 * Walk from the shadow host up to the nearest container that holds both the
 * toolbar and the textarea. The container (not the textarea itself, which is
 * too narrow) is what reply-detection signals must be read from.
 */
function findComposeContext(panelEl: HTMLElement | null): ComposeContext | null {
  if (!panelEl) return null
  let host: Element | null = panelEl
  const root = panelEl.getRootNode()
  if (root instanceof ShadowRoot) {
    host = root.host
  }
  if (host) {
    let container = host.parentElement
    for (let i = 0; i < 5 && container; i++) {
      // Read the whole compose box, not a nested `[data-text="true"]` run --
      // Draft.js wraps each plain-text segment between mentions/links in
      // its own such node, so querySelector (which only returns the first
      // match) silently truncated the read at the first @mention or link,
      // undercounting everything typed after it.
      const textarea = container.querySelector<HTMLElement>(
        'div[data-testid="tweetTextarea_0"]'
      )
      if (textarea) return { container, textarea }
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

function findNearestComposeBox(
  panelEl: HTMLElement | null
): HTMLElement | null {
  if (panelEl) {
    return findComposeContext(panelEl)?.textarea ?? null
  }
  // Fallback: global search (only before the ref is attached on first render)
  return document.querySelector<HTMLElement>(
    'div[data-testid="tweetTextarea_0"]'
  )
}

/**
 * Draft.js renders each line as a sibling `[data-block="true"]` div rather
 * than separating them with literal "\n" text nodes, so `.textContent` on
 * the compose box glues every line together with no separator at all
 * (three one-line sentences read back as one run-on string). Read the
 * blocks in document order and rejoin them with "\n" instead.
 */
function readComposeText(composeBox: HTMLElement): string {
  const blocks = composeBox.querySelectorAll<HTMLElement>('[data-block="true"]')
  if (blocks.length === 0) return composeBox.textContent ?? ""
  return Array.from(blocks)
    .map((block) => block.textContent ?? "")
    .join("\n")
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
 *
 * Reply-context detection (kind/parentText) is recomputed on the same poll
 * tick, alongside text, rather than once at mount -- the panel persists
 * across modal open/close, so a mount-time-only read would go stale the
 * moment a reply modal opens or closes under an already-mounted panel.
 */
function useComposeText(panelRef: React.RefObject<HTMLElement | null>): {
  text: string
  kind: ComposerKind
  parentText: string | null
  media: import("@postpilot/core/scoring/types").ComposeMedia
  readNow: () => void
} {
  const [text, setText] = useState("")
  const [kind, setKind] = useState<ComposerKind>("original")
  const [parentText, setParentText] = useState<string | null>(null)
  const [media, setMedia] = useState(EMPTY_MEDIA)
  const lastTextRef = useRef("")

  const readNow = useCallback(() => {
    const composeBox = findNearestComposeBox(panelRef.current)
    const raw = composeBox ? readComposeText(composeBox) : ""
    if (raw !== lastTextRef.current) {
      lastTextRef.current = raw
      setText(raw)
    }

    const ctx = findComposeContext(panelRef.current)
    setKind(detectComposerKind(ctx?.container ?? null))
    setParentText(readParentTweetText(ctx?.container ?? null))
    setMedia(detectComposeMedia(ctx?.container ?? null, raw))
  }, [panelRef])

  useEffect(() => {
    const interval = setInterval(readNow, 200)

    return () => clearInterval(interval)
  }, [readNow])

  return { text, kind, parentText, media, readNow }
}

export function PostPilotPanel() {
  const panelRef = useRef<HTMLDivElement>(null)
  const { text, kind, parentText, media, readNow: readTextNow } = useComposeText(panelRef)
  const [expanded, setExpanded] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [fingerprint, setFingerprint] = useState<VoiceFingerprint | null>(null)
  const [overrides, setOverrides] = useState<VoiceOverrides | null>(null)
  const [insights, setInsights] = useState<LearnedInsights | null>(null)
  const [funnel, setFunnel] = useState<CollectionFunnelSnapshot | null>(null)
  const [collectedPosts, setCollectedPosts] = useState<CollectedPost[]>([])
  const [selfReply, setSelfReply] = useState<string | null>(null)
  const [configRevision, setConfigRevision] = useState(0)
  const [isPro, setIsPro] = useState(false)
  const [weekStats, setWeekStats] = useState<WeekStats | null>(null)
  const [drafts, setDrafts] = useState<DraftEntry[]>([])
  const [hooks, setHooks] = useState<HookEntry[]>([])
  const [savedMsg, setSavedMsg] = useState(false)
  const [hookSavedMsg, setHookSavedMsg] = useState(false)
  const [reviewPromptVisible, setReviewPromptVisible] = useState(false)
  const lastScoreRef = useRef<number>(0)
  const lastHookTypeRef = useRef<PostScore["hookScore"]["hookType"]>(null)
  const lastKindRef = useRef<ComposerKind>("original")
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

  // Check Pro license status on mount (dev bypass, dev builds only: set
  // postpilot_dev_pro=true in storage). devPro must never be honored on a
  // real Web Store build -- that storage key is writable by anyone via
  // devtools, so trusting it there would unlock Pro for free.
  useEffect(() => {
    validateStoredLicense().then((status) => {
      if (status.isActive) { setIsPro(true); return }
      if (!isDevBuild()) return
      const storage = getStorage()
      if (!storage) return
      storage.get("postpilot_dev_pro", (r) => {
        if (r.postpilot_dev_pro === true) setIsPro(true)
      })
    }).catch((err) => console.error("[PostPilot]", err))
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
      } catch (err) { console.error("[PostPilot]", err) }
    })

    const listener = (changes: Record<string, { newValue?: unknown }>) => {
      try {
        if ("postpilot_enabled" in changes) {
          setEnabled(changes.postpilot_enabled.newValue !== false)
        }
      } catch (err) { console.error("[PostPilot]", err) }
    }
    storage.onChanged.addListener(listener)
    return () => { try { storage.onChanged.removeListener(listener) } catch {} }
  }, [])

  // Load voice fingerprint from storage
  useEffect(() => {
    loadFingerprint().then(setFingerprint).catch((err) => console.error("[PostPilot]", err))

    const storage = getStorage()
    if (!storage) return

    const listener = (changes: Record<string, { newValue?: unknown }>) => {
      try {
        if ("postpilot_voice_fingerprint" in changes) {
          setFingerprint(
            (changes.postpilot_voice_fingerprint.newValue as VoiceFingerprint) ?? null
          )
        }
      } catch (err) { console.error("[PostPilot]", err) }
    }
    storage.onChanged.addListener(listener)
    return () => { try { storage.onChanged.removeListener(listener) } catch {} }
  }, [])

  // Load voice overrides from storage
  useEffect(() => {
    loadVoiceOverrides().then(setOverrides).catch((err) => console.error("[PostPilot]", err))

    const storage = getStorage()
    if (!storage) return

    const listener = (changes: Record<string, { newValue?: unknown }>) => {
      try {
        if ("postpilot_voice_overrides" in changes) {
          setOverrides(
            (changes.postpilot_voice_overrides.newValue as VoiceOverrides) ?? null
          )
        }
      } catch (err) { console.error("[PostPilot]", err) }
    }
    storage.onChanged.addListener(listener)
    return () => { try { storage.onChanged.removeListener(listener) } catch {} }
  }, [])

  // Load learned insights from storage
  useEffect(() => {
    loadLearnedInsights().then(setInsights).catch((err) => console.error("[PostPilot]", err))

    const storage = getStorage()
    if (!storage) return

    const listener = (changes: Record<string, { newValue?: unknown }>) => {
      try {
        if ("postpilot_learned_insights" in changes) {
          setInsights(
            (changes.postpilot_learned_insights.newValue as LearnedInsights) ?? null
          )
        }
      } catch (err) { console.error("[PostPilot]", err) }
    }
    storage.onChanged.addListener(listener)
    return () => { try { storage.onChanged.removeListener(listener) } catch {} }
  }, [])

  // Collection funnel (Pro, until learning is ready) + reach corpus
  useEffect(() => {
    loadFunnelSnapshot().then(setFunnel).catch((err) => console.error("[PostPilot]", err))
    loadCollectedPosts().then(setCollectedPosts).catch((err) => console.error("[PostPilot]", err))

    const storage = getStorage()
    if (!storage) return

    const listener = (changes: Record<string, { newValue?: unknown }>) => {
      try {
        if (
          STORAGE_KEYS.COLLECTED_POSTS in changes ||
          STORAGE_KEYS.USER_HANDLE in changes ||
          STORAGE_KEYS.COLLECTION_FUNNEL in changes
        ) {
          loadFunnelSnapshot().then(setFunnel).catch((err) => console.error("[PostPilot]", err))
        }
        if (STORAGE_KEYS.COLLECTED_POSTS in changes) {
          setCollectedPosts(
            (changes.postpilot_collected_posts.newValue as CollectedPost[]) ?? []
          )
        }
      } catch (err) { console.error("[PostPilot]", err) }
    }
    storage.onChanged.addListener(listener)
    return () => { try { storage.onChanged.removeListener(listener) } catch {} }
  }, [])

  const commitClearSave = useCallback((prev: string, score: number, pro: boolean) => {
    lastSavedAtRef.current = Date.now()
    saveScoreEntry(score).then(() => {
      getWeekStats().then(setWeekStats).catch((err) => console.error("[PostPilot]", err))
    }).catch((err) => console.error("[PostPilot]", err))
    if (score >= 70) {
      recordHighScorePost().then((show) => {
        if (show) setReviewPromptVisible(true)
      }).catch((err) => console.error("[PostPilot]", err))
    }
    if (pro && score >= 70) {
      saveHook(prev, null, score, "auto").then((entry) => {
        setHooks((h) => [entry, ...h.filter((x) => x.id !== entry.id)].slice(0, 50))
      }).catch((err) => console.error("[PostPilot]", err))
    }
    if (pro) {
      const suggestion = suggestSelfReply(
        prev,
        lastHookTypeRef.current,
        lastKindRef.current
      )
      if (suggestion) setSelfReply(suggestion)
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

  // Capture the score the moment the Post/Reply button is clicked, instead of
  // relying solely on the compose box going empty afterward. A reply modal
  // can unmount the instant the reply succeeds -- before the next 200ms poll
  // tick ever observes the box as empty -- so the clear-detection above never
  // schedules a pending save, leaving nothing for the unmount-flush to catch.
  useEffect(() => {
    const ctx = findComposeContext(panelRef.current)
    if (!ctx) return

    const handleClick = (e: MouseEvent) => {
      const button = (e.target as HTMLElement).closest<HTMLElement>(
        '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]'
      )
      if (!button) return

      const score = lastScoreRef.current
      const currentComposeBox = findNearestComposeBox(panelRef.current)
      const currentText = currentComposeBox ? readComposeText(currentComposeBox) : ""
      if (
        currentText.length >= 20 &&
        score > 0 &&
        Date.now() - lastSavedAtRef.current > 30_000
      ) {
        if (pendingClearRef.current) {
          window.clearTimeout(pendingClearRef.current.timer)
          pendingClearRef.current = null
        }
        commitClearSave(currentText, score, isProRef.current)
      }
    }

    ctx.container.addEventListener("click", handleClick, true)
    return () => ctx.container.removeEventListener("click", handleClick, true)
  }, [commitClearSave])

  // While expanded, lift the containing timeline cell above its siblings.
  // X's virtualized cells are transform-positioned siblings — each one is its
  // own stacking context, painted in DOM order — so the details dropdown
  // (z-index 9999) can never escape its cell and later cells paint over it.
  useEffect(() => {
    if (!expanded) return
    const root = panelRef.current?.getRootNode()
    const host = root instanceof ShadowRoot ? (root.host as HTMLElement) : null
    if (!host) return
    const targets: HTMLElement[] = [host]
    const cell = host.closest<HTMLElement>('[data-testid="cellInnerDiv"]')
    if (cell) targets.push(cell)
    const prev = targets.map((t) => ({ t, z: t.style.zIndex, pos: t.style.position }))
    for (const t of targets) {
      t.style.zIndex = "9999"
      if (getComputedStyle(t).position === "static") t.style.position = "relative"
    }
    return () => {
      for (const { t, z, pos } of prev) {
        t.style.zIndex = z
        t.style.position = pos
      }
    }
  }, [expanded])

  // Plasmo's <plasmo-csui> host is an unknown custom element (inline by
  // default). Nowrap chips in the bar can then inflate it past the compose
  // column and force a horizontal page scroll to see the dropdown.
  useEffect(() => {
    const root = panelRef.current?.getRootNode()
    const host = root instanceof ShadowRoot ? (root.host as HTMLElement) : null
    if (!host) return
    host.style.display = "block"
    host.style.width = "100%"
    host.style.maxWidth = "100%"
    host.style.minWidth = "0"
    host.style.boxSizing = "border-box"
  }, [])

  // Load week stats, drafts, and hooks on mount; keep in sync with storage changes
  useEffect(() => {
    getWeekStats().then(setWeekStats).catch((err) => console.error("[PostPilot]", err))
    loadDrafts().then(setDrafts).catch((err) => console.error("[PostPilot]", err))
    loadHooks().then(setHooks).catch((err) => console.error("[PostPilot]", err))
    shouldShowPrompt().then(setReviewPromptVisible).catch((err) => console.error("[PostPilot]", err))

    const storage = getStorage()
    if (!storage) return
    const listener = (changes: Record<string, { newValue?: unknown }>) => {
      try {
        if ("postpilot_score_history" in changes) {
          getWeekStats().then(setWeekStats).catch((err) => console.error("[PostPilot]", err))
        }
        if ("postpilot_drafts" in changes) {
          setDrafts((changes.postpilot_drafts.newValue as DraftEntry[]) ?? [])
        }
        if ("postpilot_hook_library" in changes) {
          setHooks((changes.postpilot_hook_library.newValue as HookEntry[]) ?? [])
        }
      } catch (err) { console.error("[PostPilot]", err) }
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
    if (selfReply) {
      return (
        <div className="postpilot-root" ref={panelRef}>
          <SelfReplyPrompt
            suggestion={selfReply}
            onInsert={() => {
              injectText(panelRef.current, selfReply)
              setSelfReply(null)
              setTimeout(readTextNow, 300)
            }}
            onDismiss={() => setSelfReply(null)}
          />
        </div>
      )
    }
    return <div className="postpilot-root" ref={panelRef} />
  }

  // configRevision forces re-render when config changes, scorePost reads updated config
  void configRevision
  const proFingerprint = isPro ? fingerprint : null
  const proOverrides = isPro ? overrides : null
  const hookTypeBoosts = isPro && insights?.isReady ? insights.hookTypeBoosts : undefined
  const mediaBoosts =
    isPro && insights?.isReady && insights.mediaPerformance
      ? {
          imageBoost: insights.mediaPerformance.imageBoost,
          videoBoost: insights.mediaPerformance.videoBoost,
          linkBoost: insights.mediaPerformance.linkBoost
        }
      : null
  const scoreContext: ScoreContext = {
    kind,
    replyInsights: isPro && insights?.replyInsights ? insights.replyInsights : null,
    parentText,
    originalLengthRange:
      isPro && insights?.isReady ? insights.optimalLengthRange : null,
    media,
    mediaBoosts
  }
  const result: PostScore = scorePost(
    text,
    proFingerprint,
    hookTypeBoosts,
    proOverrides,
    scoreContext
  )
  lastScoreRef.current = result.hookScore.totalScore
  lastHookTypeRef.current = result.hookScore.hookType
  lastKindRef.current = result.kind

  function handleSaveDraft() {
    saveDraft(text, result.hookScore.totalScore, result.hookScore.hookType)
      .then((entry) => {
        setDrafts((prev) => [entry, ...prev].slice(0, 20))
        setSavedMsg(true)
        setTimeout(() => setSavedMsg(false), 1500)
      })
      .catch((err) => console.error("[PostPilot]", err))
  }

  function handleSaveHook() {
    saveHook(text, result.hookScore.hookType, result.hookScore.totalScore, "manual")
      .then((entry) => {
        setHooks((prev) => [entry, ...prev.filter((h) => h.id !== entry.id)].slice(0, 50))
        setHookSavedMsg(true)
        setTimeout(() => setHookSavedMsg(false), 1500)
      })
      .catch((err) => console.error("[PostPilot]", err))
  }

  function handleRestoreDraft(draft: DraftEntry) {
    setTimeout(() => injectText(panelRef.current, draft.text), 10)
  }

  function handleDeleteDraft(id: string) {
    deleteDraft(id).then(() => {
      setDrafts((prev) => prev.filter((d) => d.id !== id))
    }).catch((err) => console.error("[PostPilot]", err))
  }

  const errorCount = result.governor.issues.filter(
    (i) => i.severity === "error"
  ).length
  const warningCount = result.governor.issues.filter(
    (i) => i.severity === "warning"
  ).length
  const totalIssues = errorCount + warningCount
  const showLearnFunnel = isPro && !insights?.isReady && funnel !== null
  const postingTime =
    isPro && insights?.isReady ? evaluatePostingTime(insights) : null
  const reach =
    isPro && insights?.isReady
      ? estimateReachRange(collectedPosts, {
          hookType: result.hookScore.hookType,
          charCount: result.charCount,
          isReply: result.kind === "reply"
        })
      : null
  const replyInvite =
    result.kind !== "reply" ? scoreReplyInvite(text) : null
  const checklist = buildPrePublishChecklist({
    hookScore: result.hookScore.totalScore,
    governorErrors: errorCount,
    inSweetSpot: result.inSweetSpot,
    hasImage: result.media.hasImage || result.media.hasVideo,
    hasLink: result.media.hasLink,
    mediaDelta: result.mediaDelta,
    nowGood: postingTime ? postingTime.nowGood : null
  })

  const openAnalyticsSettings = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    try {
      chrome.runtime.sendMessage({ type: "OPEN_OPTIONS_TAB", tab: "analytics" })
    } catch (err) {
      console.error("[PostPilot]", err)
    }
  }

  return (
    <div className="postpilot-root" ref={panelRef}>
      <div
        className="postpilot-bar"
        onClick={() => setExpanded(!expanded)}
        style={expanded ? { borderRadius: "12px 12px 0 0" } : undefined}>
        <ScoreBadge score={result.hookScore.totalScore} />
        <HookTypeLabel hookType={result.hookScore.hookType} />
        <CharacterCount
          count={result.charCount}
          inSweetSpot={result.inSweetSpot}
          sweetSpotRange={result.sweetSpotRange}
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
        {postingTime && (
          <span className={postingTime.nowGood ? "postpilot-best-time" : "postpilot-better-time"}>
            {postingTime.label}
          </span>
        )}
        {reach && (
          <span className="postpilot-reach">
            ~{formatReach(reach.low)}–{formatReach(reach.high)} · n={reach.n}
          </span>
        )}
        {replyInvite && replyInvite.kind !== "broadcast" && (
          <span className={replyInvite.kind === "invite" ? "postpilot-invite" : "postpilot-invite postpilot-invite--bait"}>
            {replyInvite.label}
          </span>
        )}
        {showLearnFunnel && (
          <span className="postpilot-learn-chip">
            {funnel.collected}/{funnel.needed}
          </span>
        )}
        {drafts.length > 0 && (
          <span className="postpilot-drafts-count">
            {drafts.length} draft{drafts.length !== 1 ? "s" : ""}
          </span>
        )}
        <span className="postpilot-logo">PostPilot</span>
      </div>

      {expanded && (
        <div className="postpilot-details">
          {reviewPromptVisible && (
            <ReviewPrompt onDone={() => setReviewPromptVisible(false)} />
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
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
          <PrePublishChecklist items={checklist} />
          <GovernorWarnings issues={result.governor.issues} />
          {/* Always offer rewrite — previously hidden at score ≥65, which hid
              the button on borderline posts (e.g. 66) that still need a stronger open. */}
          <RewriteSuggestions
            originalText={text}
            score={result}
            isPro={isPro}
            fingerprint={proFingerprint}
            overrides={proOverrides}
            hookTypeBoosts={hookTypeBoosts}
            context={scoreContext}
            onReplace={(newText) => {
              setTimeout(() => {
                injectText(panelRef.current, newText)
                setTimeout(readTextNow, 300)
              }, 10)
            }}
          />
          {weekStats && <ScoreHistoryBadge stats={weekStats} />}
          {isPro && result.voiceMatch && (
            <VoiceMatchBreakdown voiceMatch={result.voiceMatch} />
          )}
          {isPro && insights?.isReady && (
            <InsightsPanel
              insights={insights}
              currentHookType={result.hookScore.hookType}
              isReply={result.kind === "reply"}
            />
          )}
          {showLearnFunnel && (
            <div className="postpilot-funnel">
              <div className="postpilot-details__heading">Learning</div>
              <div>
                {funnel.collected}/{funnel.needed} posts collected
              </div>
              <div className="postpilot-funnel__bar">
                <div
                  className="postpilot-funnel__bar-fill"
                  style={{
                    width: `${Math.min(100, (funnel.collected / funnel.needed) * 100)}%`
                  }}
                />
              </div>
              {!funnel.handle && (
                <div className="postpilot-funnel__hint">
                  Open x.com logged in so PostPilot can tell which posts are yours.
                </div>
              )}
              {funnel.waitingOnAge > 0 && (
                <div className="postpilot-funnel__hint">
                  {funnel.waitingOnAge} waiting 24h for views to settle.
                </div>
              )}
              {funnel.missingImpressions > 0 && (
                <div className="postpilot-funnel__hint">
                  {funnel.missingImpressions} missing view counts — open your profile.
                </div>
              )}
              <button
                type="button"
                className="postpilot-funnel__link"
                onClick={openAnalyticsSettings}>
                Import Analytics CSV in Settings
              </button>
            </div>
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
                deleteHook(id).then(() => setHooks((prev) => prev.filter((h) => h.id !== id))).catch((err) => console.error("[PostPilot]", err))
              }}
            />
          )}
          {!isPro && (
            <div style={{ padding: "8px 12px", fontSize: "12px", color: "#888", borderTop: "1px solid #eee", marginTop: "4px" }}>
              <a href="https://postpilotpro.lemonsqueezy.com/checkout/buy/40669ef5-0219-4b06-ac42-0d9cbdf7885f?discount=0" target="_blank" rel="noreferrer" style={{ color: "#1d9bf0", textDecoration: "none" }}>
                Upgrade to PostPilot Pro
              </a>
              {" "}for Voice Match &amp; the learning engine
            </div>
          )}
        </div>
      )}
    </div>
  )
}
