import type {
  PlasmoCSConfig,
  PlasmoGetInlineAnchorList,
  PlasmoGetStyle
} from "plasmo"
import React from "react"

import { ThreadSummaryPanel } from "~components/ThreadSummaryPanel"
import overlayStyles from "data-text:~styles/overlay.css"

export const config: PlasmoCSConfig = {
  matches: ["https://x.com/*", "https://twitter.com/*"]
}

// Inject after the last toolbar only — ThreadSummaryPanel hides itself
// when fewer than 2 tweets have content
export const getInlineAnchorList: PlasmoGetInlineAnchorList = async () => {
  const toolbars = document.querySelectorAll('[data-testid="toolBar"]')
  if (toolbars.length < 2) return []
  const last = toolbars[toolbars.length - 1]
  return [{ element: last, insertPosition: "afterend" as const }]
}

export const mountInterval = 1000

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = overlayStyles
  return style
}

export default function ThreadSummary() {
  return <ThreadSummaryPanel />
}
