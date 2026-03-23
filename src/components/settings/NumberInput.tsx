import React from "react"

interface NumberInputProps {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  hint?: string
}

export function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  hint
}: NumberInputProps) {
  return (
    <div style={styles.wrapper}>
      <div style={styles.row}>
        <label style={styles.label}>{label}</label>
        <input
          type="number"
          value={value}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v)) onChange(v)
          }}
          min={min}
          max={max}
          step={step}
          style={styles.input}
        />
      </div>
      {hint && <div style={styles.hint}>{hint}</div>}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    marginBottom: 8
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  label: {
    fontSize: 13,
    color: "#e7e9ea"
  },
  input: {
    width: 70,
    padding: "4px 8px",
    background: "#1e2024",
    border: "1px solid #2f3336",
    borderRadius: 6,
    color: "#e7e9ea",
    fontSize: 13,
    textAlign: "right" as const
  },
  hint: {
    fontSize: 11,
    color: "#71767b",
    marginTop: 2
  }
}
