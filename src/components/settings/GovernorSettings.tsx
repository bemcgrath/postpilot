import React from "react"

import type { GovernorConfig } from "~config/types"

import { NumberInput } from "./NumberInput"
import { ToggleSwitch } from "./ToggleSwitch"
import { PhraseListEditor } from "./PhraseListEditor"

interface GovernorSettingsProps {
  config: GovernorConfig
  onChange: (config: GovernorConfig) => void
}

export function GovernorSettings({ config, onChange }: GovernorSettingsProps) {
  return (
    <div>
      <h2 style={styles.heading}>Length Thresholds</h2>

      <NumberInput
        label="Error threshold (hard block)"
        value={config.lengthErrorThreshold}
        onChange={(v) =>
          onChange({ ...config, lengthErrorThreshold: v })
        }
        min={100}
        max={10000}
        hint="Posts longer than this get an error"
      />

      <NumberInput
        label="Warning threshold"
        value={config.lengthWarningThreshold}
        onChange={(v) =>
          onChange({ ...config, lengthWarningThreshold: v })
        }
        min={100}
        max={10000}
        hint="Posts longer than this get a warning"
      />

      <div style={styles.divider} />

      <h2 style={styles.heading}>Checks</h2>

      <ToggleSwitch
        label="Emoji warning"
        checked={config.emojiWarningEnabled}
        onChange={(v) =>
          onChange({ ...config, emojiWarningEnabled: v })
        }
      />

      <div style={styles.divider} />

      <h2 style={styles.heading}>Phrase Lists</h2>

      <PhraseListEditor
        title="Banned Phrases"
        phrases={config.bannedPhrases}
        onChange={(phrases) =>
          onChange({ ...config, bannedPhrases: phrases })
        }
        severity="error"
      />

      <PhraseListEditor
        title="Weak Phrases"
        phrases={config.weakPhrases}
        onChange={(phrases) =>
          onChange({ ...config, weakPhrases: phrases })
        }
        severity="warning"
      />

      <PhraseListEditor
        title="Fabrication Patterns"
        phrases={config.fabricationPatterns}
        onChange={(phrases) =>
          onChange({ ...config, fabricationPatterns: phrases })
        }
        severity="warning"
      />

      <PhraseListEditor
        title="Fabricated Stats"
        phrases={config.fabricatedStatsPatterns}
        onChange={(phrases) =>
          onChange({ ...config, fabricatedStatsPatterns: phrases })
        }
        severity="error"
      />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  heading: {
    fontSize: 14,
    fontWeight: 600,
    color: "#e7e9ea",
    margin: "0 0 10px"
  },
  divider: {
    height: 1,
    background: "#2f3336",
    margin: "16px 0"
  }
}
