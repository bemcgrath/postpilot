import React from "react"

interface BarData {
  label: string
  value: number
  count?: number
}

interface PerformanceChartProps {
  bars: BarData[]
  /** Format the value for display (default: "1.3x") */
  formatValue?: (value: number) => string
}

export function PerformanceChart({
  bars,
  formatValue = (v) => v.toFixed(1) + "x"
}: PerformanceChartProps) {
  if (bars.length === 0) {
    return <div style={styles.empty}>Not enough data yet</div>
  }

  const maxValue = Math.max(...bars.map((b) => b.value), 1)

  return (
    <div style={styles.container}>
      {bars.map((bar) => (
        <div key={bar.label} style={styles.row}>
          <div style={styles.label}>{bar.label}</div>
          <div style={styles.barContainer}>
            <div
              style={{
                ...styles.bar,
                width: `${Math.max(2, (bar.value / maxValue) * 100)}%`,
                background:
                  bar.value >= 1.3
                    ? "#00ba7c"
                    : bar.value >= 1.0
                      ? "#1d9bf0"
                      : bar.value >= 0.8
                        ? "#f7b731"
                        : "#f4212e"
              }}
            />
          </div>
          <div style={styles.value}>
            {formatValue(bar.value)}
            {bar.count != null && (
              <span style={styles.count}> ({bar.count})</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: 6
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13
  },
  label: {
    width: 100,
    flexShrink: 0,
    color: "#e7e9ea",
    fontSize: 12,
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis"
  },
  barContainer: {
    flex: 1,
    height: 16,
    background: "#2f3336",
    borderRadius: 4,
    overflow: "hidden"
  },
  bar: {
    height: "100%",
    borderRadius: 4,
    transition: "width 0.3s ease"
  },
  value: {
    width: 70,
    flexShrink: 0,
    textAlign: "right" as const,
    color: "#e7e9ea",
    fontSize: 12,
    fontVariantNumeric: "tabular-nums"
  },
  count: {
    color: "#71767b",
    fontSize: 11
  },
  empty: {
    color: "#71767b",
    fontSize: 13,
    fontStyle: "italic"
  }
}
