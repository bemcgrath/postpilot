import type {
  PlasmoCSConfig,
  PlasmoGetInlineAnchorList,
  PlasmoGetStyle
} from "plasmo"
import React from "react"

import { PostPilotPanel } from "~components/PostPilotPanel"

import overlayStyles from "data-text:~styles/overlay.css"

export const config: PlasmoCSConfig = {
  matches: ["https://x.com/*", "https://twitter.com/*"]
}

// Use anchor list with a query that re-scans on DOM changes
export const getInlineAnchorList: PlasmoGetInlineAnchorList = async () => {
  const anchors: ReturnType<typeof document.querySelectorAll> =
    document.querySelectorAll('[data-testid="toolBar"]')
  return Array.from(anchors).map((element) => ({
    element,
    insertPosition: "afterend" as const
  }))
}

// Re-scan interval so Plasmo finds compose boxes opened after page load
export const mountInterval = 1000

// Inject styles into Shadow DOM for full isolation
export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = overlayStyles
  return style
}

export default function ScoreOverlay() {
  return <PostPilotPanel />
}
