import type { PlasmoCSConfig } from "plasmo"

import { initConfig } from "~config/config-storage"
import { validateStoredLicense } from "~config/license"
import { humanizeHookType } from "~scoring/hook-types"
import { scorePost } from "~scoring/scoring-pipeline"
import { loadFingerprint, loadVoiceOverrides } from "~scoring/voice-storage"
import { loadLearnedInsights } from "~learning/storage"
import type { VoiceFingerprint, VoiceOverrides } from "~scoring/voice-types"

export const config: PlasmoCSConfig = {
  matches: ["https://x.com/*", "https://twitter.com/*"]
}

const BADGE_CLASS = "pp-viral-badge"

// Loaded once at init. This feature is already gated to active Pro licenses
// (see init() below), so feed badges should score with the same personalized
// inputs as the compose panel — otherwise the same text scores differently
// depending on which "PostPilot" badge is showing it, with no indication why.
let fingerprint: VoiceFingerprint | null = null
let overrides: VoiceOverrides | null = null
let hookTypeBoosts: Record<string, number> | undefined = undefined

function scoreColor(s: number): string {
  if (s >= 70) return "#00ba7c"
  if (s >= 50) return "#f7b731"
  return "#f4212e"
}

function extractTweetText(article: Element): string {
  const tweetText = article.querySelector('[data-testid="tweetText"]')
  if (!tweetText) return ""
  return tweetText.textContent ?? ""
}

function injectBadge(article: Element, score: number, hookType: string | null, text: string) {
  const badge = document.createElement("div")
  badge.className = BADGE_CLASS
  badge.setAttribute("data-pp-text", text)

  const color = scoreColor(score)
  // Absolutely positioned overlay: the badge must never affect the article's
  // height. X's virtualized timeline re-measures cells on layout change, and
  // an in-flow badge made posts visibly bounce every time X's own re-renders
  // removed it and the MutationObserver re-injected it.
  badge.style.cssText = [
    "position:absolute",
    "top:8px",
    "right:44px",
    "z-index:1",
    "display:inline-flex",
    "align-items:center",
    "gap:5px",
    "padding:2px 7px",
    "border-radius:4px",
    "font-size:11px",
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    `border:1px solid ${color}40`,
    "background:rgba(0,0,0,0.55)",
    "pointer-events:none",
    "user-select:none",
  ].join(";")

  const scoreEl = document.createElement("span")
  scoreEl.style.cssText = `font-weight:700;color:${color}`
  scoreEl.textContent = String(score)
  badge.appendChild(scoreEl)

  if (hookType) {
    const sep = document.createElement("span")
    sep.style.color = "#8b98a5"
    sep.textContent = "·"
    badge.appendChild(sep)

    const typeEl = document.createElement("span")
    typeEl.style.cssText = "color:#8b98a5;font-size:10px"
    typeEl.textContent = humanizeHookType(hookType)
    badge.appendChild(typeEl)
  }

  const label = document.createElement("span")
  label.style.cssText = "color:#8b98a5;font-size:10px;opacity:0.7"
  label.textContent = "PostPilot"
  badge.appendChild(label)

  const host = article as HTMLElement
  if (getComputedStyle(host).position === "static") {
    host.style.position = "relative"
  }
  host.appendChild(badge)
}

function processTweet(article: Element) {
  const text = extractTweetText(article)
  if (!text || text.length < 15) return

  const existing = article.querySelector<HTMLElement>(`.${BADGE_CLASS}`)
  if (existing?.getAttribute("data-pp-text") === text) return
  existing?.remove()

  const result = scorePost(text, fingerprint, hookTypeBoosts, overrides)
  injectBadge(article, result.hookScore.totalScore, result.hookScore.hookType, text)
}

function processAll() {
  document.querySelectorAll('[data-testid="tweet"]').forEach(processTweet)
}

let rafPending = false

function scheduleProcess() {
  if (rafPending) return
  rafPending = true
  requestAnimationFrame(() => {
    processAll()
    rafPending = false
  })
}

async function init() {
  try { initConfig() } catch {}

  const status = await validateStoredLicense().catch(() => ({ isActive: false }))
  if (!status.isActive) return

  const [fp, ov, insights] = await Promise.all([
    loadFingerprint().catch(() => null),
    loadVoiceOverrides().catch(() => null),
    loadLearnedInsights().catch(() => null),
  ])
  fingerprint = fp
  overrides = ov
  hookTypeBoosts = insights?.isReady ? insights.hookTypeBoosts : undefined

  processAll()

  const observer = new MutationObserver(scheduleProcess)
  observer.observe(document.body, { childList: true, subtree: true })
}

init()
