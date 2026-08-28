import React from "react"

interface InsightCardProps {
  title: string
  children: React.ReactNode
}

export function InsightCard({ title, children }: InsightCardProps) {
  return (
    <div style={styles.card}>
      <div style={styles.title}>{title}</div>
      {children}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "#1e2024",
    border: "1px solid #2f3336",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12
  },
  title: {
    fontSize: 11,
    color: "#71767b",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 8,
    fontWeight: 600
  }
}
