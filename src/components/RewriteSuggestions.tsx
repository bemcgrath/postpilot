import React, { useState } from "react"

import type { PostScore } from "~scoring/types"
import { generateRewrites } from "~rewrite/rewrite-service"
import type { RewriteSuggestion } from "~rewrite/rewrite-service"
import { humanizeHookType } from "~scoring/hook-types"

interface Props {
  originalText: string
  score: PostScore
  isPro: boolean
  onReplace: (text: string) => void
}

export function RewriteSuggestions({ originalText, score, isPro, onReplace }: Props) {
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<RewriteSuggestion[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [replacedIdx, setReplacedIdx] = useState<number | null>(null)
  const [undoText, setUndoText] = useState<string | null>(null)

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

      {error === "NO_API_KEY" ? (
        <div className="postpilot-rewrites__error">
          Add your Claude API key to use this.{" "}
          <button
            className="postpilot-rewrites__settings-link"
            onClick={() => chrome.runtime.sendMessage({ type: "OPEN_OPTIONS_TAB", tab: "aiRewrites" })}>
            Open settings
          </button>
        </div>
      ) : error ? (
        <div className="postpilot-rewrites__error">{error}</div>
      ) : null}

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
          ))}
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
                  href="https://postpilotpro.lemonsqueezy.com/checkout/buy/921ab388-2b1b-44e0-afd7-54da993317d0?discount=0"
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
