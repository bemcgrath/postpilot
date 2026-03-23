import React from "react"

import type { GovernorIssue } from "~scoring/types"

interface Props {
  issues: GovernorIssue[]
}

export function GovernorWarnings({ issues }: Props) {
  if (issues.length === 0) return null

  return (
    <div className="postpilot-details__section">
      <div className="postpilot-details__heading">Issues</div>
      {issues.map((issue, i) => (
        <div key={i} className="postpilot-warnings__item">
          <span
            className={`postpilot-warnings__icon postpilot-warnings__icon--${issue.severity}`}>
            {issue.severity === "error" ? "\u2716" : "\u26A0"}
          </span>
          <span>
            <span className="postpilot-warnings__text">{issue.message}</span>
            {issue.matchedText && (
              <span className="postpilot-warnings__match">
                {" "}
                &mdash; &ldquo;{issue.matchedText}&rdquo;
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}
