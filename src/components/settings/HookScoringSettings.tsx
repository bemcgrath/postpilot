import React from "react"

import type { HookAnalyzerConfig, PipelineConfig } from "~config/types"
import { buildDefaults } from "~config/defaults"

import { NumberInput } from "./NumberInput"

interface HookScoringSettingsProps {
  analyzerConfig: HookAnalyzerConfig
  pipelineConfig: PipelineConfig
  onAnalyzerChange: (config: HookAnalyzerConfig) => void
  onPipelineChange: (config: PipelineConfig) => void
}

export function HookScoringSettings({
  analyzerConfig,
  pipelineConfig,
  onAnalyzerChange,
  onPipelineChange
}: HookScoringSettingsProps) {
  const defaults = buildDefaults()

  const resetSection = (section: string) => {
    switch (section) {
      case "base":
        onAnalyzerChange({
          ...analyzerConfig,
          baseScore: defaults.hookAnalyzer.baseScore,
          hookTypeBonusMax: defaults.hookAnalyzer.hookTypeBonusMax
        })
        break
      case "specificity":
        onAnalyzerChange({
          ...analyzerConfig,
          specificity: { ...defaults.hookAnalyzer.specificity }
        })
        break
      case "length":
        onAnalyzerChange({
          ...analyzerConfig,
          length: { ...defaults.hookAnalyzer.length }
        })
        break
      case "curiosity":
        onAnalyzerChange({
          ...analyzerConfig,
          curiosityGap: { ...defaults.hookAnalyzer.curiosityGap }
        })
        break
      case "penalties":
        onAnalyzerChange({
          ...analyzerConfig,
          penalties: { ...defaults.hookAnalyzer.penalties }
        })
        break
      case "pipeline":
        onPipelineChange({ ...defaults.pipeline })
        break
    }
  }

  return (
    <div>
      {/* Base Scoring */}
      <SectionHeader
        title="Base Scoring"
        onReset={() => resetSection("base")}
      />
      <NumberInput
        label="Base score"
        value={analyzerConfig.baseScore}
        onChange={(v) =>
          onAnalyzerChange({ ...analyzerConfig, baseScore: v })
        }
        min={0}
        max={100}
        hint="Starting score before bonuses (default 50)"
      />
      <NumberInput
        label="Hook type bonus max"
        value={analyzerConfig.hookTypeBonusMax}
        onChange={(v) =>
          onAnalyzerChange({ ...analyzerConfig, hookTypeBonusMax: v })
        }
        min={0}
        max={30}
        hint="Max bonus from hook type detection (default 15)"
      />

      <div style={styles.divider} />

      {/* Specificity */}
      <SectionHeader
        title="Specificity Bonuses"
        onReset={() => resetSection("specificity")}
      />
      <NumberInput
        label="Numbers bonus"
        value={analyzerConfig.specificity.numbers}
        onChange={(v) =>
          onAnalyzerChange({
            ...analyzerConfig,
            specificity: { ...analyzerConfig.specificity, numbers: v }
          })
        }
        min={0}
        max={20}
      />
      <NumberInput
        label="Timeframe bonus"
        value={analyzerConfig.specificity.timeframe}
        onChange={(v) =>
          onAnalyzerChange({
            ...analyzerConfig,
            specificity: { ...analyzerConfig.specificity, timeframe: v }
          })
        }
        min={0}
        max={20}
      />
      <NumberInput
        label="Entity bonus"
        value={analyzerConfig.specificity.entity}
        onChange={(v) =>
          onAnalyzerChange({
            ...analyzerConfig,
            specificity: { ...analyzerConfig.specificity, entity: v }
          })
        }
        min={0}
        max={20}
      />

      <div style={styles.divider} />

      {/* Length Scoring */}
      <SectionHeader
        title="Hook Length Scoring"
        onReset={() => resetSection("length")}
      />
      <NumberInput
        label="Optimal min"
        value={analyzerConfig.length.optimalMin}
        onChange={(v) =>
          onAnalyzerChange({
            ...analyzerConfig,
            length: { ...analyzerConfig.length, optimalMin: v }
          })
        }
        min={0}
        max={200}
      />
      <NumberInput
        label="Optimal max"
        value={analyzerConfig.length.optimalMax}
        onChange={(v) =>
          onAnalyzerChange({
            ...analyzerConfig,
            length: { ...analyzerConfig.length, optimalMax: v }
          })
        }
        min={0}
        max={300}
      />
      <NumberInput
        label="Optimal score"
        value={analyzerConfig.length.optimalScore}
        onChange={(v) =>
          onAnalyzerChange({
            ...analyzerConfig,
            length: { ...analyzerConfig.length, optimalScore: v }
          })
        }
        min={0}
        max={20}
      />
      <NumberInput
        label="Acceptable min"
        value={analyzerConfig.length.acceptableMin}
        onChange={(v) =>
          onAnalyzerChange({
            ...analyzerConfig,
            length: { ...analyzerConfig.length, acceptableMin: v }
          })
        }
        min={0}
        max={200}
      />
      <NumberInput
        label="Acceptable max"
        value={analyzerConfig.length.acceptableMax}
        onChange={(v) =>
          onAnalyzerChange({
            ...analyzerConfig,
            length: { ...analyzerConfig.length, acceptableMax: v }
          })
        }
        min={0}
        max={300}
      />
      <NumberInput
        label="Acceptable score"
        value={analyzerConfig.length.acceptableScore}
        onChange={(v) =>
          onAnalyzerChange({
            ...analyzerConfig,
            length: { ...analyzerConfig.length, acceptableScore: v }
          })
        }
        min={0}
        max={20}
      />
      <NumberInput
        label="Hook max length"
        value={analyzerConfig.hookMaxLength}
        onChange={(v) =>
          onAnalyzerChange({ ...analyzerConfig, hookMaxLength: v })
        }
        min={50}
        max={300}
        hint="Max chars for hook extraction (default 120)"
      />

      <div style={styles.divider} />

      {/* Curiosity Gap */}
      <SectionHeader
        title="Curiosity Gap"
        onReset={() => resetSection("curiosity")}
      />
      <NumberInput
        label="Open loop bonus"
        value={analyzerConfig.curiosityGap.openLoopBonus}
        onChange={(v) =>
          onAnalyzerChange({
            ...analyzerConfig,
            curiosityGap: {
              ...analyzerConfig.curiosityGap,
              openLoopBonus: v
            }
          })
        }
        min={0}
        max={20}
      />
      <NumberInput
        label="Tension word bonus"
        value={analyzerConfig.curiosityGap.tensionWordBonus}
        onChange={(v) =>
          onAnalyzerChange({
            ...analyzerConfig,
            curiosityGap: {
              ...analyzerConfig.curiosityGap,
              tensionWordBonus: v
            }
          })
        }
        min={0}
        max={20}
      />

      <div style={styles.divider} />

      {/* Penalties */}
      <SectionHeader
        title="Penalties"
        onReset={() => resetSection("penalties")}
      />
      <NumberInput
        label="Generic opener"
        value={analyzerConfig.penalties.genericOpener}
        onChange={(v) =>
          onAnalyzerChange({
            ...analyzerConfig,
            penalties: { ...analyzerConfig.penalties, genericOpener: v }
          })
        }
        min={-30}
        max={0}
      />
      <NumberInput
        label="Bland start"
        value={analyzerConfig.penalties.blandStart}
        onChange={(v) =>
          onAnalyzerChange({
            ...analyzerConfig,
            penalties: { ...analyzerConfig.penalties, blandStart: v }
          })
        }
        min={-30}
        max={0}
      />
      <NumberInput
        label="Too long hook"
        value={analyzerConfig.penalties.tooLongHook}
        onChange={(v) =>
          onAnalyzerChange({
            ...analyzerConfig,
            penalties: { ...analyzerConfig.penalties, tooLongHook: v }
          })
        }
        min={-30}
        max={0}
      />
      <NumberInput
        label="Question without numbers"
        value={analyzerConfig.penalties.questionNoNumbers}
        onChange={(v) =>
          onAnalyzerChange({
            ...analyzerConfig,
            penalties: {
              ...analyzerConfig.penalties,
              questionNoNumbers: v
            }
          })
        }
        min={-30}
        max={0}
      />

      <div style={styles.divider} />

      {/* Weak Threshold */}
      <SectionHeader title="Threshold" onReset={() => {}} />
      <NumberInput
        label="Weak score threshold"
        value={analyzerConfig.weakThreshold}
        onChange={(v) =>
          onAnalyzerChange({ ...analyzerConfig, weakThreshold: v })
        }
        min={0}
        max={100}
        hint="Scores below this are flagged as weak (default 60)"
      />

      <div style={styles.divider} />

      {/* Pipeline Sweet Spot */}
      <SectionHeader
        title="Post Length Sweet Spot"
        onReset={() => resetSection("pipeline")}
      />
      <NumberInput
        label="Sweet spot min"
        value={pipelineConfig.sweetSpotMin}
        onChange={(v) =>
          onPipelineChange({ ...pipelineConfig, sweetSpotMin: v })
        }
        min={0}
        max={1000}
        hint="Minimum chars for 'sweet spot' indicator (default 280)"
      />
      <NumberInput
        label="Sweet spot max"
        value={pipelineConfig.sweetSpotMax}
        onChange={(v) =>
          onPipelineChange({ ...pipelineConfig, sweetSpotMax: v })
        }
        min={0}
        max={1000}
        hint="Maximum chars for 'sweet spot' indicator (default 320)"
      />
    </div>
  )
}

function SectionHeader({
  title,
  onReset
}: {
  title: string
  onReset: () => void
}) {
  return (
    <div style={styles.sectionHeader}>
      <h2 style={styles.heading}>{title}</h2>
      <button onClick={onReset} style={styles.resetLink}>
        Reset
      </button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  heading: {
    fontSize: 14,
    fontWeight: 600,
    color: "#e7e9ea",
    margin: 0
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10
  },
  resetLink: {
    background: "none",
    border: "none",
    color: "#1d9bf0",
    fontSize: 11,
    cursor: "pointer",
    padding: 0
  },
  divider: {
    height: 1,
    background: "#2f3336",
    margin: "16px 0"
  }
}
