import React, { useState } from "react"

import type { PostScore } from "~scoring/types"
import { generateRewrites } from "~rewrite/rewrite-service"
import type { RewriteSuggestion } from "~rewrite/rewrite-service"
import { humanizeHookType } from "~scoring/hook-types"

interface Props {
  originalText: string
  score: PostScore
  isPro: boolean
}

export function RewriteSuggestions({ originalText, score, isPro }: Props) {
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<RewriteSuggestion[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    setSuggestions(null)
    try {
      const results = await generateRewrites(originalText, score, isPro)
      setSuggestions(results)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg === "NO_API_KEY") {
        setError("Add your Claude API key in PostPilot settings (AI Rewrites tab) to use this feature.")
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

  function copyText(text: string, idx: number) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 1500)
    }).catch(() => {})
  }

  return (
    <div className="postpilot-rewrites">
      <div className="postpilot-details__heading">AI Rewrite{isPro ? " Suggestions" : " Suggestion"}</div>

      {!suggestions && !loading && (
        <button
          className="postpilot-rewrites__btn"
          onClick={handleGenerate}>
          {isPro ? "Generate 3 rewrites" : "Improve this post"}
        </button>
      )}

      {loading && (
        <div className="postpilot-rewrites__loading">
          Generating{isPro ? " 3 rewrites" : " rewrite"}...
        </div>
      )}

      {error && (
        <div className="postpilot-rewrites__error">{error}</div>
      )}

      {suggestions && suggestions.length > 0 && (
        <div className="postpilot-rewrites__results">
          {suggestions.map((s, i) => (
            <div key={i} className="postpilot-rewrites__card">
              <div className="postpilot-rewrites__text">{s.text}</div>
              <div className="postpilot-rewrites__footer">
                <span className="postpilot-rewrites__rationale">
                  {s.hookType ? `${humanizeHookType(s.hookType)}: ` : ""}
                  {s.rationale}
                </span>
                <button
                  className={`postpilot-rewrites__copy${copiedIdx === i ? " postpilot-rewrites__copy--copied" : ""}`}
                  onClick={() => copyText(s.text, i)}>
                  {copiedIdx === i ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          ))}
          <button
            className="postpilot-rewrites__retry"
            onClick={handleGenerate}>
            Regenerate
          </button>
        </div>
      )}
    </div>
  )
}
