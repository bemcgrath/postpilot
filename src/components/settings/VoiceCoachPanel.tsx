import React, { useState } from "react"

import type { HookTypeName } from "~scoring/types"
import type { DiagnosticTip, VoiceFingerprint, VoiceOverrides } from "~scoring/voice-types"

import { HOOK_TYPES, humanizeHookType } from "~scoring/hook-types"

const ALL_HOOK_TYPES = Object.keys(HOOK_TYPES) as HookTypeName[]

interface VoiceCoachPanelProps {
  fingerprint: VoiceFingerprint
  overrides: VoiceOverrides
  diagnostics: DiagnosticTip[]
  onChange: (overrides: VoiceOverrides) => void
}

export function VoiceCoachPanel({
  fingerprint,
  overrides,
  diagnostics,
  onChange
}: VoiceCoachPanelProps) {
  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Voice Coach</h2>

      {diagnostics.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Diagnostic Tips</div>
          {diagnostics.map((tip, i) => (
            <div key={i} style={styles.tipRow}>
              <span
                style={{
                  ...styles.tipBadge,
                  background: tip.severity === "warning" ? "#f7b731" : "#1d9bf0",
                  color: tip.severity === "warning" ? "#000" : "#fff"
                }}>
                {tip.category}
              </span>
              <span style={styles.tipMessage}>{tip.message}</span>
            </div>
          ))}
        </div>
      )}

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Manual Overrides</div>
        <p style={styles.hint}>
          Tune these to refine how your voice is scored. Overrides persist even when you re-analyze posts.
        </p>

        <WordListEditor
          label="Signature Words"
          addWords={overrides.addSignatureWords}
          removeWords={overrides.removeSignatureWords}
          existingWords={fingerprint.distinctiveTerms.map((t) => t.term)}
          onAddChange={(words) => onChange({ ...overrides, addSignatureWords: words })}
          onRemoveChange={(words) => onChange({ ...overrides, removeSignatureWords: words })}
        />

        <WordListEditor
          label="Niche Keywords"
          addWords={overrides.addNicheKeywords}
          removeWords={overrides.removeNicheKeywords}
          existingWords={fingerprint.nicheKeywords.map((t) => t.term)}
          onAddChange={(words) => onChange({ ...overrides, addNicheKeywords: words })}
          onRemoveChange={(words) => onChange({ ...overrides, removeNicheKeywords: words })}
        />

        <LengthRangeEditor
          min={overrides.lengthMin}
          max={overrides.lengthMax}
          fpMin={fingerprint.postLength.min}
          fpMax={fingerprint.postLength.max}
          fpMean={fingerprint.postLength.mean}
          onChange={(min, max) => onChange({ ...overrides, lengthMin: min, lengthMax: max })}
        />

        <HookPreferencesEditor
          selected={overrides.preferredHookTypes}
          fpTopHooks={fingerprint.topHookTypes}
          onChange={(types) => onChange({ ...overrides, preferredHookTypes: types })}
        />

        <ToneRatioEditor
          overrides={overrides}
          fingerprint={fingerprint}
          onChange={onChange}
        />
      </div>
    </div>
  )
}

// --- Word List Editor ---

function WordListEditor({
  label,
  addWords,
  removeWords,
  existingWords,
  onAddChange,
  onRemoveChange
}: {
  label: string
  addWords: string[]
  removeWords: string[]
  existingWords: string[]
  onAddChange: (words: string[]) => void
  onRemoveChange: (words: string[]) => void
}) {
  const [collapsed, setCollapsed] = useState(true)
  const [newWord, setNewWord] = useState("")

  const removeSet = new Set(removeWords.map((w) => w.toLowerCase()))
  const activeExisting = existingWords.filter((w) => !removeSet.has(w.toLowerCase()))

  const addWord = () => {
    const word = newWord.trim().toLowerCase()
    if (!word || addWords.includes(word) || existingWords.includes(word)) return
    onAddChange([...addWords, word])
    setNewWord("")
  }

  const removeAdded = (word: string) => {
    onAddChange(addWords.filter((w) => w !== word))
  }

  const toggleExisting = (word: string) => {
    const lower = word.toLowerCase()
    if (removeSet.has(lower)) {
      onRemoveChange(removeWords.filter((w) => w.toLowerCase() !== lower))
    } else {
      onRemoveChange([...removeWords, lower])
    }
  }

  return (
    <div style={styles.editorBlock}>
      <div style={styles.editorHeader} onClick={() => setCollapsed(!collapsed)}>
        <span style={styles.editorLabel}>{label}</span>
        <span style={styles.editorCount}>
          {activeExisting.length + addWords.length} active
          {removeWords.length > 0 && `, ${removeWords.length} removed`}
          <span style={styles.chevron}>{collapsed ? "\u25B6" : "\u25BC"}</span>
        </span>
      </div>

      {!collapsed && (
        <div style={styles.editorBody}>
          <div style={styles.tagContainer}>
            {existingWords.map((word) => {
              const removed = removeSet.has(word.toLowerCase())
              return (
                <span
                  key={`e-${word}`}
                  onClick={() => toggleExisting(word)}
                  style={{
                    ...styles.tag,
                    opacity: removed ? 0.4 : 1,
                    textDecoration: removed ? "line-through" : "none",
                    cursor: "pointer"
                  }}>
                  {word}
                </span>
              )
            })}
            {addWords.map((word) => (
              <span key={`a-${word}`} style={{ ...styles.tag, ...styles.tagAdded }}>
                {word}
                <span
                  onClick={() => removeAdded(word)}
                  style={styles.tagRemove}>
                  x
                </span>
              </span>
            ))}
          </div>
          <div style={styles.addRow}>
            <input
              type="text"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addWord()}
              placeholder="Add word..."
              style={styles.addInput}
            />
            <button onClick={addWord} style={styles.addBtn}>Add</button>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Length Range Editor ---

function LengthRangeEditor({
  min,
  max,
  fpMin,
  fpMax,
  fpMean,
  onChange
}: {
  min: number | null
  max: number | null
  fpMin: number
  fpMax: number
  fpMean: number
  onChange: (min: number | null, max: number | null) => void
}) {
  const [collapsed, setCollapsed] = useState(true)
  const effectiveMin = min ?? fpMin
  const effectiveMax = max ?? fpMax
  const isOverridden = min != null || max != null

  return (
    <div style={styles.editorBlock}>
      <div style={styles.editorHeader} onClick={() => setCollapsed(!collapsed)}>
        <span style={styles.editorLabel}>Length Range</span>
        <span style={styles.editorCount}>
          {effectiveMin}-{effectiveMax} chars
          {isOverridden && " (overridden)"}
          <span style={styles.chevron}>{collapsed ? "\u25B6" : "\u25BC"}</span>
        </span>
      </div>

      {!collapsed && (
        <div style={styles.editorBody}>
          <p style={styles.hint}>
            Auto-detected: {fpMin}-{fpMax} chars (avg {Math.round(fpMean)})
          </p>
          <div style={styles.rangeRow}>
            <label style={styles.rangeLabel}>
              Min
              <input
                type="number"
                value={min ?? ""}
                placeholder={String(fpMin)}
                onChange={(e) => {
                  const v = e.target.value ? parseInt(e.target.value) : null
                  onChange(v, max)
                }}
                style={styles.rangeInput}
              />
            </label>
            <label style={styles.rangeLabel}>
              Max
              <input
                type="number"
                value={max ?? ""}
                placeholder={String(fpMax)}
                onChange={(e) => {
                  const v = e.target.value ? parseInt(e.target.value) : null
                  onChange(min, v)
                }}
                style={styles.rangeInput}
              />
            </label>
            {isOverridden && (
              <button
                onClick={() => onChange(null, null)}
                style={styles.resetLink}>
                Reset
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// --- Hook Preferences Editor ---

function HookPreferencesEditor({
  selected,
  fpTopHooks,
  onChange
}: {
  selected: HookTypeName[]
  fpTopHooks: HookTypeName[]
  onChange: (types: HookTypeName[]) => void
}) {
  const [collapsed, setCollapsed] = useState(true)
  const active = selected.length > 0 ? selected : fpTopHooks

  const toggle = (ht: HookTypeName) => {
    if (selected.includes(ht)) {
      onChange(selected.filter((t) => t !== ht))
    } else if (selected.length < 5) {
      onChange([...selected, ht])
    }
  }

  return (
    <div style={styles.editorBlock}>
      <div style={styles.editorHeader} onClick={() => setCollapsed(!collapsed)}>
        <span style={styles.editorLabel}>Hook Preferences</span>
        <span style={styles.editorCount}>
          {active.length > 0 ? active.map((h) => humanizeHookType(h)).join(", ") : "none"}
          {selected.length > 0 && " (overridden)"}
          <span style={styles.chevron}>{collapsed ? "\u25B6" : "\u25BC"}</span>
        </span>
      </div>

      {!collapsed && (
        <div style={styles.editorBody}>
          <p style={styles.hint}>Select up to 5 preferred hook types. These replace the auto-detected top hooks.</p>
          <div style={styles.hookGrid}>
            {ALL_HOOK_TYPES.map((ht) => {
              const isSelected = selected.includes(ht)
              const isDetected = fpTopHooks.includes(ht)
              return (
                <div
                  key={ht}
                  onClick={() => toggle(ht)}
                  style={{
                    ...styles.hookOption,
                    borderColor: isSelected ? "#1d9bf0" : isDetected ? "#2f3336" : "#2f3336",
                    background: isSelected ? "rgba(29,155,240,0.1)" : "#1e2024"
                  }}>
                  <span style={{ fontSize: 12, color: isSelected ? "#1d9bf0" : "#e7e9ea" }}>
                    {humanizeHookType(ht)}
                  </span>
                  {isDetected && !isSelected && (
                    <span style={{ fontSize: 9, color: "#71767b" }}>detected</span>
                  )}
                </div>
              )
            })}
          </div>
          {selected.length > 0 && (
            <button onClick={() => onChange([])} style={styles.resetLink}>
              Reset to auto-detected
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// --- Tone Ratio Editor ---

function ToneRatioEditor({
  overrides,
  fingerprint,
  onChange
}: {
  overrides: VoiceOverrides
  fingerprint: VoiceFingerprint
  onChange: (o: VoiceOverrides) => void
}) {
  const [collapsed, setCollapsed] = useState(true)

  const ratios = [
    {
      label: "First person (I/my)",
      key: "firstPersonRatio" as const,
      fpValue: fingerprint.firstPersonRatio
    },
    {
      label: "Second person (you/your)",
      key: "secondPersonRatio" as const,
      fpValue: fingerprint.secondPersonRatio
    },
    {
      label: "Questions",
      key: "questionRatio" as const,
      fpValue: fingerprint.questionRatio
    },
    {
      label: "Exclamations",
      key: "exclamationRatio" as const,
      fpValue: fingerprint.exclamationRatio
    }
  ]

  const hasOverride = ratios.some((r) => overrides[r.key] != null)

  return (
    <div style={styles.editorBlock}>
      <div style={styles.editorHeader} onClick={() => setCollapsed(!collapsed)}>
        <span style={styles.editorLabel}>Tone Ratios</span>
        <span style={styles.editorCount}>
          {hasOverride ? "overridden" : "auto-detected"}
          <span style={styles.chevron}>{collapsed ? "\u25B6" : "\u25BC"}</span>
        </span>
      </div>

      {!collapsed && (
        <div style={styles.editorBody}>
          <p style={styles.hint}>
            Set target percentages for tone dimensions. Leave blank to use auto-detected values.
          </p>
          {ratios.map((r) => {
            const current = overrides[r.key]
            return (
              <div key={r.key} style={styles.ratioRow}>
                <span style={styles.ratioLabel}>{r.label}</span>
                <span style={styles.ratioDetected}>
                  {Math.round(r.fpValue * 100)}%
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={current != null ? Math.round(current * 100) : Math.round(r.fpValue * 100)}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) / 100
                    onChange({ ...overrides, [r.key]: val })
                  }}
                  style={styles.slider}
                />
                <span style={styles.ratioValue}>
                  {current != null ? Math.round(current * 100) : Math.round(r.fpValue * 100)}%
                </span>
                {current != null && (
                  <button
                    onClick={() => onChange({ ...overrides, [r.key]: null })}
                    style={styles.ratioReset}>
                    x
                  </button>
                )}
              </div>
            )
          })}
          {hasOverride && (
            <button
              onClick={() =>
                onChange({
                  ...overrides,
                  firstPersonRatio: null,
                  secondPersonRatio: null,
                  questionRatio: null,
                  exclamationRatio: null
                })
              }
              style={styles.resetLink}>
              Reset all to auto-detected
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// --- Styles ---

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginTop: 16
  },
  heading: {
    fontSize: 15,
    fontWeight: 600,
    margin: "0 0 12px",
    color: "#e7e9ea"
  },
  section: {
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 11,
    color: "#71767b",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 8
  },
  hint: {
    fontSize: 12,
    color: "#71767b",
    margin: "0 0 10px",
    lineHeight: 1.4
  },
  tipRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    padding: "6px 0"
  },
  tipBadge: {
    fontSize: 10,
    fontWeight: 600,
    padding: "2px 6px",
    borderRadius: 4,
    flexShrink: 0,
    whiteSpace: "nowrap" as const
  },
  tipMessage: {
    fontSize: 13,
    color: "#e7e9ea",
    lineHeight: 1.4
  },
  editorBlock: {
    border: "1px solid #2f3336",
    borderRadius: 8,
    marginBottom: 8,
    overflow: "hidden"
  },
  editorHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 12px",
    cursor: "pointer",
    background: "#1e2024"
  },
  editorLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: "#e7e9ea"
  },
  editorCount: {
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
  editorBody: {
    padding: "8px 12px 12px",
    background: "#16181c"
  },
  tagContainer: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 4,
    marginBottom: 8
  },
  tag: {
    background: "#2f3336",
    padding: "2px 8px",
    borderRadius: 10,
    fontSize: 12,
    color: "#e7e9ea"
  },
  tagAdded: {
    background: "rgba(29,155,240,0.2)",
    border: "1px solid #1d9bf0"
  },
  tagRemove: {
    marginLeft: 4,
    cursor: "pointer",
    color: "#71767b",
    fontSize: 10
  },
  addRow: {
    display: "flex",
    gap: 6
  },
  addInput: {
    flex: 1,
    padding: "4px 8px",
    background: "#1e2024",
    border: "1px solid #2f3336",
    borderRadius: 6,
    color: "#e7e9ea",
    fontSize: 12
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
  },
  rangeRow: {
    display: "flex",
    alignItems: "center",
    gap: 12
  },
  rangeLabel: {
    fontSize: 12,
    color: "#e7e9ea",
    display: "flex",
    flexDirection: "column" as const,
    gap: 4
  },
  rangeInput: {
    width: 80,
    padding: "4px 8px",
    background: "#1e2024",
    border: "1px solid #2f3336",
    borderRadius: 6,
    color: "#e7e9ea",
    fontSize: 12
  },
  hookGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 4,
    maxHeight: 240,
    overflowY: "auto" as const
  },
  hookOption: {
    padding: "6px 10px",
    border: "1px solid",
    borderRadius: 6,
    cursor: "pointer",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  ratioRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "4px 0"
  },
  ratioLabel: {
    fontSize: 12,
    color: "#e7e9ea",
    width: 150,
    flexShrink: 0
  },
  ratioDetected: {
    fontSize: 11,
    color: "#71767b",
    width: 36,
    textAlign: "right" as const,
    flexShrink: 0
  },
  slider: {
    flex: 1,
    accentColor: "#1d9bf0"
  },
  ratioValue: {
    fontSize: 12,
    color: "#1d9bf0",
    fontWeight: 600,
    width: 36,
    textAlign: "right" as const,
    flexShrink: 0
  },
  ratioReset: {
    background: "none",
    border: "none",
    color: "#71767b",
    cursor: "pointer",
    fontSize: 12,
    padding: "0 4px",
    flexShrink: 0
  }
}
