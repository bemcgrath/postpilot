import React, { useState } from "react"

import type { PhraseEntry } from "~config/types"

interface PhraseListEditorProps {
  title: string
  phrases: PhraseEntry[]
  onChange: (phrases: PhraseEntry[]) => void
  severity: "error" | "warning"
}

export function PhraseListEditor({
  title,
  phrases,
  onChange,
  severity
}: PhraseListEditorProps) {
  const [collapsed, setCollapsed] = useState(true)
  const [newPattern, setNewPattern] = useState("")
  const [newLabel, setNewLabel] = useState("")

  const defaultCount = phrases.filter((p) => !p.isCustom).length
  const customCount = phrases.filter((p) => p.isCustom).length
  const activeCount = phrases.filter((p) => p.enabled).length

  const togglePhrase = (id: string) => {
    onChange(
      phrases.map((p) =>
        p.id === id ? { ...p, enabled: !p.enabled } : p
      )
    )
  }

  const removePhrase = (id: string) => {
    onChange(phrases.filter((p) => p.id !== id))
  }

  const addCustom = () => {
    const pattern = newPattern.trim()
    if (!pattern) return

    // Validate regex
    try {
      new RegExp(pattern, "i")
    } catch {
      return
    }

    const entry: PhraseEntry = {
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      pattern,
      label: newLabel.trim() || undefined,
      enabled: true,
      isCustom: true
    }
    onChange([...phrases, entry])
    setNewPattern("")
    setNewLabel("")
  }

  const resetDefaults = () => {
    onChange(phrases.map((p) => (p.isCustom ? p : { ...p, enabled: true })))
  }

  const severityDot = severity === "error" ? "#f4212e" : "#f7b731"

  return (
    <div style={styles.container}>
      <div
        style={styles.header}
        onClick={() => setCollapsed(!collapsed)}>
        <span style={styles.headerLeft}>
          <span style={{ ...styles.dot, background: severityDot }} />
          <span style={styles.title}>{title}</span>
        </span>
        <span style={styles.counts}>
          {defaultCount} default, {customCount} custom, {activeCount} active
          <span style={styles.chevron}>{collapsed ? "\u25B6" : "\u25BC"}</span>
        </span>
      </div>

      {!collapsed && (
        <div style={styles.body}>
          {phrases.map((p) => (
            <div key={p.id} style={styles.phraseRow}>
              <div
                style={{
                  ...styles.checkbox,
                  background: p.enabled ? "#1d9bf0" : "#2f3336",
                  borderColor: p.enabled ? "#1d9bf0" : "#536471"
                }}
                onClick={() => togglePhrase(p.id)}>
                {p.enabled && <span style={styles.check}>&#10003;</span>}
              </div>
              <div style={styles.phraseInfo}>
                <span
                  style={{
                    ...styles.phrasePattern,
                    opacity: p.enabled ? 1 : 0.5
                  }}>
                  {p.label || p.pattern}
                </span>
                {p.label && (
                  <span style={styles.phrasePatternSmall}>{p.pattern}</span>
                )}
              </div>
              {p.isCustom && (
                <button
                  onClick={() => removePhrase(p.id)}
                  style={styles.removeBtn}
                  title="Remove custom phrase">
                  &#x2715;
                </button>
              )}
            </div>
          ))}

          <div style={styles.addRow}>
            <input
              type="text"
              placeholder="Regex pattern..."
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              style={styles.addInput}
            />
            <input
              type="text"
              placeholder="Label (optional)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              style={{ ...styles.addInput, width: 120 }}
            />
            <button onClick={addCustom} style={styles.addBtn}>
              Add
            </button>
          </div>

          <button onClick={resetDefaults} style={styles.resetLink}>
            Reset to defaults
          </button>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginBottom: 12,
    border: "1px solid #2f3336",
    borderRadius: 8,
    overflow: "hidden"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 12px",
    cursor: "pointer",
    background: "#1e2024"
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    display: "inline-block"
  },
  title: {
    fontSize: 13,
    fontWeight: 600,
    color: "#e7e9ea"
  },
  counts: {
    fontSize: 11,
    color: "#71767b",
    display: "flex",
    alignItems: "center",
    gap: 6
  },
  chevron: {
    fontSize: 8,
    color: "#71767b"
  },
  body: {
    padding: "8px 12px 12px",
    background: "#16181c",
    maxHeight: 300,
    overflowY: "auto" as const
  },
  phraseRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "4px 0"
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    border: "1px solid",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0
  },
  check: {
    fontSize: 10,
    color: "#fff",
    lineHeight: 1
  },
  phraseInfo: {
    flex: 1,
    minWidth: 0
  },
  phrasePattern: {
    fontSize: 12,
    color: "#e7e9ea",
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const
  },
  phrasePatternSmall: {
    fontSize: 10,
    color: "#536471",
    fontFamily: "monospace",
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const
  },
  removeBtn: {
    background: "none",
    border: "none",
    color: "#f4212e",
    cursor: "pointer",
    fontSize: 12,
    padding: "0 4px",
    flexShrink: 0
  },
  addRow: {
    display: "flex",
    gap: 6,
    marginTop: 10
  },
  addInput: {
    flex: 1,
    padding: "4px 8px",
    background: "#1e2024",
    border: "1px solid #2f3336",
    borderRadius: 6,
    color: "#e7e9ea",
    fontSize: 12,
    fontFamily: "monospace"
  },
  addBtn: {
    padding: "4px 12px",
    background: "#2f3336",
    border: "none",
    borderRadius: 6,
    color: "#e7e9ea",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer"
  },
  resetLink: {
    background: "none",
    border: "none",
    color: "#1d9bf0",
    fontSize: 11,
    cursor: "pointer",
    marginTop: 8,
    padding: 0
  }
}
