import React, { useState } from "react"

import type { HookTypeName } from "~scoring/types"
import type { HookTypesConfig, HookTypeOverride } from "~config/types"

import { HOOK_TYPES, humanizeHookType } from "~scoring/hook-types"

interface HookTypesSettingsProps {
  config: HookTypesConfig
  onChange: (config: HookTypesConfig) => void
}

export function HookTypesSettings({
  config,
  onChange
}: HookTypesSettingsProps) {
  const [expandedType, setExpandedType] = useState<HookTypeName | null>(null)

  // Sort by weight descending
  const sortedTypes = (Object.keys(HOOK_TYPES) as HookTypeName[]).sort(
    (a, b) => {
      const wA = config.overrides[a]?.baseWeight ?? HOOK_TYPES[a].baseWeight
      const wB = config.overrides[b]?.baseWeight ?? HOOK_TYPES[b].baseWeight
      return wB - wA
    }
  )

  const getOverride = (name: HookTypeName): HookTypeOverride => {
    return config.overrides[name] ?? {
      enabled: true,
      baseWeight: HOOK_TYPES[name].baseWeight,
      customPatterns: []
    }
  }

  const setOverride = (name: HookTypeName, override: HookTypeOverride) => {
    onChange({
      ...config,
      overrides: {
        ...config.overrides,
        [name]: override
      }
    })
  }

  const resetAll = () => {
    onChange({ overrides: {} })
  }

  return (
    <div>
      <div style={styles.headerRow}>
        <h2 style={styles.heading}>
          Hook Types ({sortedTypes.length})
        </h2>
        <button onClick={resetAll} style={styles.resetLink}>
          Reset all
        </button>
      </div>

      <div style={styles.grid}>
        {sortedTypes.map((name) => {
          const def = HOOK_TYPES[name]
          const override = getOverride(name)
          const isExpanded = expandedType === name
          const weight = override.baseWeight

          return (
            <div
              key={name}
              style={{
                ...styles.card,
                opacity: override.enabled ? 1 : 0.5
              }}>
              <div style={styles.cardHeader}>
                <div style={styles.cardLeft}>
                  <div
                    style={{
                      ...styles.checkbox,
                      background: override.enabled ? "#1d9bf0" : "#2f3336",
                      borderColor: override.enabled ? "#1d9bf0" : "#536471"
                    }}
                    onClick={() =>
                      setOverride(name, {
                        ...override,
                        enabled: !override.enabled
                      })
                    }>
                    {override.enabled && (
                      <span style={styles.check}>&#10003;</span>
                    )}
                  </div>
                  <div>
                    <div style={styles.hookName}>
                      {humanizeHookType(name)}
                    </div>
                    <div style={styles.hookDesc}>{def.description}</div>
                  </div>
                </div>
                <div style={styles.weightBadge}>
                  {weight.toFixed(2)}
                </div>
              </div>

              <div style={styles.sliderRow}>
                <span style={styles.sliderLabel}>Weight</span>
                <input
                  type="range"
                  min={0.8}
                  max={1.5}
                  step={0.05}
                  value={weight}
                  onChange={(e) =>
                    setOverride(name, {
                      ...override,
                      baseWeight: parseFloat(e.target.value)
                    })
                  }
                  style={styles.slider}
                />
                <span style={styles.sliderValue}>
                  {weight.toFixed(2)}
                </span>
              </div>

              <button
                onClick={() =>
                  setExpandedType(isExpanded ? null : name)
                }
                style={styles.patternsToggle}>
                {isExpanded ? "Hide" : "Show"} patterns (
                {def.patterns.length +
                  (override.customPatterns?.length ?? 0)}
                )
              </button>

              {isExpanded && (
                <div style={styles.patternsSection}>
                  <div style={styles.patternGroup}>
                    <div style={styles.patternGroupLabel}>
                      Default patterns
                    </div>
                    {def.patterns.map((p, i) => (
                      <div key={i} style={styles.patternItem}>
                        <code style={styles.patternCode}>{p}</code>
                      </div>
                    ))}
                  </div>

                  {(override.customPatterns?.length ?? 0) > 0 && (
                    <div style={styles.patternGroup}>
                      <div style={styles.patternGroupLabel}>
                        Custom patterns
                      </div>
                      {override.customPatterns?.map((p, i) => (
                        <div key={i} style={styles.patternItem}>
                          <code style={styles.patternCode}>{p}</code>
                          <button
                            onClick={() => {
                              const newPatterns = [
                                ...(override.customPatterns ?? [])
                              ]
                              newPatterns.splice(i, 1)
                              setOverride(name, {
                                ...override,
                                customPatterns: newPatterns
                              })
                            }}
                            style={styles.removeBtn}>
                            &#x2715;
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <AddPatternInput
                    onAdd={(pattern) => {
                      setOverride(name, {
                        ...override,
                        customPatterns: [
                          ...(override.customPatterns ?? []),
                          pattern
                        ]
                      })
                    }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AddPatternInput({ onAdd }: { onAdd: (pattern: string) => void }) {
  const [value, setValue] = useState("")

  const add = () => {
    const pattern = value.trim()
    if (!pattern) return
    try {
      new RegExp(pattern, "i")
    } catch {
      return
    }
    onAdd(pattern)
    setValue("")
  }

  return (
    <div style={styles.addRow}>
      <input
        type="text"
        placeholder="Add custom regex pattern..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && add()}
        style={styles.addInput}
      />
      <button onClick={add} style={styles.addBtn}>
        Add
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
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12
  },
  resetLink: {
    background: "none",
    border: "none",
    color: "#1d9bf0",
    fontSize: 11,
    cursor: "pointer",
    padding: 0
  },
  grid: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8
  },
  card: {
    background: "#1e2024",
    border: "1px solid #2f3336",
    borderRadius: 8,
    padding: 12
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start"
  },
  cardLeft: {
    display: "flex",
    gap: 8,
    flex: 1
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
    flexShrink: 0,
    marginTop: 2
  },
  check: {
    fontSize: 10,
    color: "#fff",
    lineHeight: 1
  },
  hookName: {
    fontSize: 13,
    fontWeight: 600,
    color: "#e7e9ea"
  },
  hookDesc: {
    fontSize: 11,
    color: "#71767b",
    marginTop: 2
  },
  weightBadge: {
    background: "#2f3336",
    padding: "2px 8px",
    borderRadius: 10,
    fontSize: 12,
    color: "#1d9bf0",
    fontWeight: 600,
    flexShrink: 0
  },
  sliderRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 8
  },
  sliderLabel: {
    fontSize: 11,
    color: "#71767b",
    flexShrink: 0
  },
  slider: {
    flex: 1,
    height: 4,
    accentColor: "#1d9bf0"
  },
  sliderValue: {
    fontSize: 11,
    color: "#e7e9ea",
    fontWeight: 600,
    width: 32,
    textAlign: "right" as const,
    flexShrink: 0
  },
  patternsToggle: {
    background: "none",
    border: "none",
    color: "#71767b",
    fontSize: 11,
    cursor: "pointer",
    padding: 0,
    marginTop: 8
  },
  patternsSection: {
    marginTop: 8,
    padding: "8px 0 0",
    borderTop: "1px solid #2f3336"
  },
  patternGroup: {
    marginBottom: 8
  },
  patternGroupLabel: {
    fontSize: 10,
    color: "#71767b",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 4
  },
  patternItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "2px 0"
  },
  patternCode: {
    fontSize: 11,
    color: "#e7e9ea",
    fontFamily: "monospace",
    wordBreak: "break-all" as const
  },
  removeBtn: {
    background: "none",
    border: "none",
    color: "#f4212e",
    cursor: "pointer",
    fontSize: 10,
    padding: "0 4px",
    flexShrink: 0
  },
  addRow: {
    display: "flex",
    gap: 6,
    marginTop: 4
  },
  addInput: {
    flex: 1,
    padding: "4px 8px",
    background: "#16181c",
    border: "1px solid #2f3336",
    borderRadius: 6,
    color: "#e7e9ea",
    fontSize: 11,
    fontFamily: "monospace"
  },
  addBtn: {
    padding: "4px 10px",
    background: "#2f3336",
    border: "none",
    borderRadius: 6,
    color: "#e7e9ea",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer"
  }
}
