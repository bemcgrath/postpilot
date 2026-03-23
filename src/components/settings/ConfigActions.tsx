import React, { useRef, useState } from "react"

import type { PostPilotConfig } from "~config/types"
import { buildDefaults } from "~config/defaults"

interface ConfigActionsProps {
  config: PostPilotConfig
  onImport: (config: PostPilotConfig) => void
  onReset: () => void
}

export function ConfigActions({
  config,
  onImport,
  onReset
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

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string)

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
          accept=".json"
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
