import React, { useRef, useState } from "react"

import type { GovernorConfig, PhraseEntry, PostPilotConfig } from "~config/types"
import { buildDefaults } from "~config/defaults"

type PhraseListKey = "bannedPhrases" | "weakPhrases" | "fabricationPatterns" | "fabricatedStatsPatterns"

/** Section heading aliases mapped to GovernorConfig phrase list keys. */
const SECTION_MAP: Record<string, PhraseListKey> = {
  "banned phrases": "bannedPhrases",
  "banned": "bannedPhrases",
  "hard blocks": "bannedPhrases",
  "hard block": "bannedPhrases",
  "weak phrases": "weakPhrases",
  "weak": "weakPhrases",
  "soft flags": "weakPhrases",
  "soft flag": "weakPhrases",
  "review required": "weakPhrases",
  "fabrication patterns": "fabricationPatterns",
  "fabrication": "fabricationPatterns",
  "integrity checks": "fabricationPatterns",
  "integrity": "fabricationPatterns",
  "fabricated stats": "fabricatedStatsPatterns",
  "fabricated stats patterns": "fabricatedStatsPatterns",
  "quality thresholds": "fabricatedStatsPatterns"
}

/** Strip parenthetical suffixes and normalize a heading for lookup. */
function normalizeHeading(raw: string): string {
  return raw
    .replace(/\(.*?\)/g, "")
    .replace(/[:\-–—]/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

/** Parse a governor markdown file into phrase entries grouped by section. */
function parseGovernorMarkdown(
  text: string
): Partial<Record<keyof GovernorConfig, PhraseEntry[]>> {
  const result: Partial<Record<string, PhraseEntry[]>> = {}
  let currentKey: string | null = null

  for (const line of text.split("\n")) {
    const trimmed = line.trim()

    // Check for heading
    const headingMatch = trimmed.match(/^#{1,3}\s+(.+)$/)
    if (headingMatch) {
      const heading = normalizeHeading(headingMatch[1])
      currentKey = SECTION_MAP[heading] ?? null
      continue
    }

    // Check for bullet line
    if (currentKey && /^[-*•]\s+/.test(trimmed)) {
      const phrase = trimmed.replace(/^[-*•]\s+/, "").trim()
      if (!phrase) continue

      if (!result[currentKey]) result[currentKey] = []

      // Support "pattern | label" format
      const pipeIdx = phrase.indexOf("|")
      const pattern = pipeIdx >= 0 ? phrase.slice(0, pipeIdx).trim() : phrase
      const label = pipeIdx >= 0 ? phrase.slice(pipeIdx + 1).trim() : undefined

      result[currentKey]!.push({
        id: `import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        pattern,
        label: label || undefined,
        enabled: true,
        isCustom: true
      })
    }
  }
  return result
}

interface ConfigActionsProps {
  config: PostPilotConfig
  onImport: (config: PostPilotConfig) => void
  onReset: () => void
  onGovernorImport?: (config: GovernorConfig) => void
}

export function ConfigActions({
  config,
  onImport,
  onReset,
  onGovernorImport
}: ConfigActionsProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState("")
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const handleExport = () => {
    const json = JSON.stringify(config, null, 2)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `postpilot-config-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setStatus("Config exported")
  }

  const handleImport = () => {
    fileRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isMarkdown = /\.(md|txt|markdown)$/i.test(file.name)

    const reader = new FileReader()
    reader.onload = () => {
      const content = reader.result as string

      if (isMarkdown) {
        // Parse markdown into governor phrases
        const sections = parseGovernorMarkdown(content)
        const keys = Object.keys(sections)
        if (keys.length === 0) {
          setStatus("No recognized sections found. Use headings like: # Banned Phrases, # Weak Phrases")
          return
        }

        const merged: GovernorConfig = { ...config.governor }
        let totalAdded = 0
        for (const [key, phrases] of Object.entries(sections)) {
          const existing = merged[key as keyof GovernorConfig] as PhraseEntry[]
          const existingPatterns = new Set(existing.map((p) => p.pattern.toLowerCase()))
          const newPhrases = (phrases as PhraseEntry[]).filter(
            (p) => !existingPatterns.has(p.pattern.toLowerCase())
          )
          ;(merged as unknown as Record<string, unknown>)[key] = [...existing, ...newPhrases]
          totalAdded += newPhrases.length
        }

        if (onGovernorImport) {
          onGovernorImport(merged)
        } else {
          onImport({ ...config, governor: merged })
        }
        setStatus(`Imported ${totalAdded} phrase${totalAdded === 1 ? "" : "s"} from ${keys.length} section${keys.length === 1 ? "" : "s"}`)
        return
      }

      try {
        const parsed = JSON.parse(content)

        // Basic validation
        if (!parsed.schemaVersion || !parsed.governor || !parsed.hookAnalyzer) {
          setStatus("Invalid config file: missing required sections")
          return
        }

        // Merge with defaults to fill any missing fields
        const merged: PostPilotConfig = {
          ...buildDefaults(),
          ...parsed,
          governor: {
            ...buildDefaults().governor,
            ...(parsed.governor ?? {})
          },
          hookAnalyzer: {
            ...buildDefaults().hookAnalyzer,
            ...(parsed.hookAnalyzer ?? {}),
            specificity: {
              ...buildDefaults().hookAnalyzer.specificity,
              ...(parsed.hookAnalyzer?.specificity ?? {})
            },
            length: {
              ...buildDefaults().hookAnalyzer.length,
              ...(parsed.hookAnalyzer?.length ?? {})
            },
            curiosityGap: {
              ...buildDefaults().hookAnalyzer.curiosityGap,
              ...(parsed.hookAnalyzer?.curiosityGap ?? {})
            },
            penalties: {
              ...buildDefaults().hookAnalyzer.penalties,
              ...(parsed.hookAnalyzer?.penalties ?? {})
            }
          },
          hookTypes: {
            ...buildDefaults().hookTypes,
            ...(parsed.hookTypes ?? {})
          },
          pipeline: {
            ...buildDefaults().pipeline,
            ...(parsed.pipeline ?? {})
          }
        }

        onImport(merged)
        setStatus("Config imported successfully")
      } catch {
        setStatus("Failed to parse config file")
      }
    }
    reader.readAsText(file)

    // Reset file input
    e.target.value = ""
  }

  const handleReset = () => {
    if (!showResetConfirm) {
      setShowResetConfirm(true)
      return
    }
    onReset()
    setShowResetConfirm(false)
    setStatus("Config reset to defaults")
  }

  return (
    <div style={styles.container}>
      <div style={styles.divider} />

      <div style={styles.actions}>
        <button onClick={handleExport} style={styles.button}>
          Export Config
        </button>

        <button onClick={handleImport} style={styles.button}>
          Import Config
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.md,.txt,.markdown"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />

        <button
          onClick={handleReset}
          style={{
            ...styles.button,
            ...(showResetConfirm ? styles.dangerButton : {})
          }}>
          {showResetConfirm ? "Confirm Reset" : "Reset All"}
        </button>

        {showResetConfirm && (
          <button
            onClick={() => setShowResetConfirm(false)}
            style={styles.cancelBtn}>
            Cancel
          </button>
        )}
      </div>

      {status && <p style={styles.status}>{status}</p>}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginTop: 16
  },
  divider: {
    height: 1,
    background: "#2f3336",
    marginBottom: 16
  },
  actions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap" as const
  },
  button: {
    padding: "6px 14px",
    background: "#2f3336",
    border: "none",
    borderRadius: 8,
    color: "#e7e9ea",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer"
  },
  dangerButton: {
    background: "#f4212e",
    color: "#fff"
  },
  cancelBtn: {
    background: "none",
    border: "none",
    color: "#71767b",
    fontSize: 12,
    cursor: "pointer",
    padding: "6px 8px"
  },
  status: {
    fontSize: 12,
    color: "#1d9bf0",
    marginTop: 8
  }
}
