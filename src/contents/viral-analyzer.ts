import type { PlasmoCSConfig } from "plasmo"

import { initConfig } from "~config/config-storage"
import { validateStoredLicense } from "~config/license"
import { humanizeHookType } from "~scoring/hook-types"
import { scorePost } from "~scoring/scoring-pipeline"

export const config: PlasmoCSConfig = {
  matches: ["https://x.com/*", "https://twitter.com/*"]
}

const BADGE_CLASS = "pp-viral-badge"

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
  badge.style.cssText = [
    "display:inline-flex",
    "align-items:center",
    "gap:5px",
    "padding:3px 7px",
    "margin:4px 0 2px 0",
    "border-radius:4px",
    "font-size:11px",
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    `border:1px solid ${color}40`,
    "background:rgba(0,0,0,0.03)",
    "cursor:default",
    "user-select:none",
  ].join(";")

  const scoreEl = document.createElement("span")
  scoreEl.style.cssText = `font-weight:700;color:${color}`
  scoreEl.textContent = String(score)
  badge.appendChild(scoreEl)

  if (hookType) {
    const sep = document.createElement("span")
    sep.style.color = "#536471"
    sep.textContent = "·"
    badge.appendChild(sep)

    const typeEl = document.createElement("span")
    typeEl.style.cssText = "color:#536471;font-size:10px"
    typeEl.textContent = humanizeHookType(hookType)
    badge.appendChild(typeEl)
  }

  const label = document.createElement("span")
  label.style.cssText = "color:#536471;font-size:10px;opacity:0.6"
  label.textContent = "PostPilot"
  badge.appendChild(label)

  // Insert before the action bar
  const actionBar = article.querySelector('[role="group"]')
  if (actionBar?.parentElement) {
    actionBar.parentElement.insertBefore(badge, actionBar)
  } else {
    article.appendChild(badge)
  }
}

function processTweet(article: Element) {
  const text = extractTweetText(article)
  if (!text || text.length < 15) return

  const existing = article.querySelector<HTMLElement>(`.${BADGE_CLASS}`)
  if (existing?.getAttribute("data-pp-text") === text) return
  existing?.remove()

  const result = scorePost(text, null, undefined, null)
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

  processAll()

  const observer = new MutationObserver(scheduleProcess)
  observer.observe(document.body, { childList: true, subtree: true })
}

init()
