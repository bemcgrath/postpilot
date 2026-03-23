import React from "react"

interface ToggleSwitchProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function ToggleSwitch({ label, checked, onChange }: ToggleSwitchProps) {
  return (
    <div style={styles.row} onClick={() => onChange(!checked)}>
      <span style={styles.label}>{label}</span>
      <div
        style={{
          ...styles.track,
          background: checked ? "#1d9bf0" : "#2f3336"
        }}>
        <div
          style={{
            ...styles.thumb,
            transform: checked ? "translateX(16px)" : "translateX(0)"
          }}
        />
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 0",
    cursor: "pointer"
  },
  label: {
    fontSize: 13,
    color: "#e7e9ea"
  },
  track: {
    width: 36,
    height: 20,
    borderRadius: 10,
    position: "relative" as const,
    transition: "background 0.2s",
    flexShrink: 0
  },
  thumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    background: "#fff",
    position: "absolute" as const,
    top: 2,
    left: 2,
    transition: "transform 0.2s"
  }
}
