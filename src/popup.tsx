import React, { useEffect, useState } from "react"

function getStorage(): typeof chrome.storage.local | null {
  try {
    if (
      typeof chrome !== "undefined" &&
      typeof chrome.storage !== "undefined" &&
      typeof chrome.storage.local !== "undefined"
    ) {
      return chrome.storage.local
    }
  } catch {}
  return null
}

function openOptionsPage() {
  try {
    if (typeof chrome !== "undefined" && chrome.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage()
    }
  } catch {
    // fallback: do nothing
  }
}

function Popup() {
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    const storage = getStorage()
    if (!storage) return
    storage.get("postpilot_enabled", (result) => {
      if (result && result.postpilot_enabled === false) {
        setEnabled(false)
      }
    })
  }, [])

  const toggle = () => {
    const next = !enabled
    setEnabled(next)
    const storage = getStorage()
    if (storage) storage.set({ postpilot_enabled: next })
  }

  return (
    <div
      style={{
        width: 240,
        padding: 20,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        background: "#16181c",
        color: "#e7e9ea"
      }}>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          marginBottom: 4
        }}>
        PostPilot
      </div>
      <div style={{ fontSize: 12, color: "#71767b", marginBottom: 16 }}>
        v0.2.0 &mdash; Score your posts as you type
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
          fontSize: 14,
          marginBottom: 12
        }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={toggle}
          style={{ width: 16, height: 16, cursor: "pointer" }}
        />
        {enabled ? "Scoring enabled" : "Scoring disabled"}
      </label>

      <button
        onClick={openOptionsPage}
        style={{
          width: "100%",
          padding: "8px 0",
          background: "#2f3336",
          border: "none",
          borderRadius: 8,
          color: "#e7e9ea",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer"
        }}>
        Voice Settings
      </button>
    </div>
  )
}

export default Popup
