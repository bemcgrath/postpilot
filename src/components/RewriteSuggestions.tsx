import React, { useState } from "react"

import type { PostScore } from "~scoring/types"
import type { VoiceFingerprint, VoiceOverrides } from "~scoring/voice-types"
import { scorePost } from "~scoring/scoring-pipeline"
import { generateRewrites } from "~rewrite/rewrite-service"
import type { RewriteSuggestion } from "~rewrite/rewrite-service"
import { humanizeHookType } from "~scoring/hook-types"

interface ScoredSuggestion extends RewriteSuggestion {
  computedScore: number
  governorIssues: Array<{ severity: string; matchedText: string }>
}

interface Props {
  originalText: string
  score: PostScore
  isPro: boolean
  fingerprint: VoiceFingerprint | null
  overrides: VoiceOverrides | null
  hookTypeBoosts: Record<string, number> | undefined
  onReplace: (text: string) => void
}

function scoreColor(s: number): string {
  if (s >= 70) return "#00ba7c"
  if (s >= 50) return "#f7b731"
  return "#f4212e"
}

export function RewriteSuggestions({ originalText, score, isPro, fingerprint, overrides, hookTypeBoosts, onReplace }: Props) {
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<ScoredSuggestion[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [replacedIdx, setReplacedIdx] = useState<number | null>(null)
  const [undoText, setUndoText] = useState<string | null>(null)

  const originalScore = score.hookScore.totalScore
  const isBorderlineOrAbove = originalScore >= 65
  const generateLabel = isPro
    ? isBorderlineOrAbove
      ? "Rewrite anyway (3 variants)"
      : "Generate 3 rewrites"
    : isBorderlineOrAbove
      ? "Rewrite anyway"
      : "Improve this post"

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    setSuggestions(null)
    setUndoText(null)
    try {
      const results = await generateRewrites(originalText, score, isPro)
      const scored: ScoredSuggestion[] = results.map((r) => {
        const s = scorePost(r.text, fingerprint, hookTypeBoosts, overrides)
        return {
          ...r,
          computedScore: s.hookScore.totalScore,
          governorIssues: s.governor.issues.map((i) => ({ severity: i.severity, matchedText: i.matchedText })),
        }
      })
      setSuggestions(scored)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg === "NO_API_KEY") {
        setError("NO_API_KEY")
      } else if (msg === "INVALID_API_KEY") {
        setError("Invalid API key — check the AI Rewrites tab in PostPilot settings.")
      } else if (msg === "PARSE_ERROR") {
        setError("Unexpected response from Claude. Try again.")
      } else {
        setError("Failed to generate rewrites. Check your API key and try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="postpilot-rewrites">
      <div className="postpilot-details__heading">AI Rewrite{isPro ? " Suggestions" : " Suggestion"}</div>

      {!suggestions && !loading && (
        <>
          {isBorderlineOrAbove && (
            <div className="postpilot-rewrites__hint" style={{ fontSize: "12px", color: "#71767b", marginBottom: "6px" }}>
              Score is {originalScore}/100 — solid, but a stronger hook could push it higher.
            </div>
          )}
          <button
            className="postpilot-rewrites__btn"
            onClick={handleGenerate}>
            {generateLabel}
          </button>
        </>
      )}

      {loading && (
        <div className="postpilot-rewrites__loading">
          Generating{isPro ? " 3 rewrites" : " rewrite"}...
        </div>
      )}

      {error === "NO_API_KEY" ? (
        <div className="postpilot-rewrites__error">
          Add your Claude API key to use this.{" "}
          <button
            className="postpilot-rewrites__settings-link"
            onClick={() => {
              chrome.storage.local.set({ postpilot_options_tab: "aiRewrites" }, () => {
                chrome.runtime.openOptionsPage()
              })
            }}>
            Open settings
          </button>
        </div>
      ) : error ? (
        <div className="postpilot-rewrites__error">{error}</div>
      ) : null}

      {suggestions && suggestions.length > 0 && (
        <div className="postpilot-rewrites__results">
          {suggestions.map((s, i) => {
            const delta = s.computedScore - originalScore
            return (
              <div key={i} className="postpilot-rewrites__card">
                <div className="postpilot-rewrites__card-header">
                  <span
                    className="postpilot-rewrites__score"
                    style={{ color: scoreColor(s.computedScore) }}>
                    {s.computedScore}
                  </span>
                  {delta !== 0 && (
                    <span
                      className="postpilot-rewrites__delta"
                      style={{ color: delta > 0 ? "#00ba7c" : "#f4212e" }}>
                      {delta > 0 ? `+${delta}` : delta}
                    </span>
                  )}
                  {s.hookType && (
                    <span className="postpilot-rewrites__hook-label">
                      {humanizeHookType(s.hookType)}
                    </span>
                  )}
                </div>
                <div className="postpilot-rewrites__text">{s.text}</div>
                {s.governorIssues.length > 0 && (
                  <div className="postpilot-rewrites__gov-issues">
                    {s.governorIssues.map((issue, j) => (
                      <span
                        key={j}
                        className={`postpilot-rewrites__gov-issue postpilot-rewrites__gov-issue--${issue.severity}`}>
                        {issue.matchedText}
                      </span>
                    ))}
                  </div>
                )}
                <div className="postpilot-rewrites__footer">
                  <span className="postpilot-rewrites__rationale">{s.rationale}</span>
                  <button
                    className={`postpilot-rewrites__copy postpilot-rewrites__replace${replacedIdx === i ? " postpilot-rewrites__copy--copied" : ""}`}
                    onClick={() => {
                      setUndoText(originalText)
                      onReplace(s.text)
                      setReplacedIdx(i)
                      setTimeout(() => setReplacedIdx(null), 1500)
                    }}>
                    {replacedIdx === i ? "Done!" : "Use this"}
                  </button>
                </div>
              </div>
            )
          })}
          {undoText && (
            <button
              className="postpilot-rewrites__undo"
              onClick={() => {
                onReplace(undoText)
                setUndoText(null)
                setReplacedIdx(null)
              }}>
              Undo replacement
            </button>
          )}
          <div className="postpilot-rewrites__regen-row">
            <button
              className="postpilot-rewrites__retry"
              onClick={handleGenerate}>
              Regenerate
            </button>
            {!isPro && (
              <span className="postpilot-rewrites__pro-nudge">
                Pro gets 3 variants —{" "}
                <a
                  href="https://postpilotpro.lemonsqueezy.com/checkout/buy/40669ef5-0219-4b06-ac42-0d9cbdf7885f?discount=0"
                  target="_blank"
                  rel="noreferrer"
                  className="postpilot-rewrites__pro-link">
                  upgrade
                </a>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
