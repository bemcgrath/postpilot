import React, { useState } from "react"

import type { GovernorIssue, PostScore } from "@postpilot/core/scoring/types"
import type { VoiceFingerprint, VoiceOverrides } from "@postpilot/core/scoring/voice-types"
import { scorePost } from "@postpilot/core/scoring/scoring-pipeline"
import type { ScoreContext } from "@postpilot/core/scoring/scoring-pipeline"
import { generateRewrites } from "~rewrite/rewrite-service"
import type { RewriteSuggestion } from "~rewrite/rewrite-service"
import { splitHookBody } from "@postpilot/core/rewrite/hook-split"
import { humanizeHookType } from "@postpilot/core/scoring/hook-types"

interface ScoredSuggestion extends RewriteSuggestion {
  computedScore: number
  governorIssues: Array<Pick<GovernorIssue, "severity" | "matchedText" | "message">>
}

interface Props {
  originalText: string
  score: PostScore
  isPro: boolean
  fingerprint: VoiceFingerprint | null
  overrides: VoiceOverrides | null
  hookTypeBoosts: Record<string, number> | undefined
  context?: ScoreContext
  onReplace: (text: string) => void
}

function scoreColor(s: number): string {
  if (s >= 70) return "#00ba7c"
  if (s >= 50) return "#f7b731"
  return "#f4212e"
}

function HookPreview({ text }: { text: string }) {
  const { hook, rest } = splitHookBody(text)
  if (!rest) return <>{hook}</>
  return (
    <>
      <span className="postpilot-rewrites__hook-line">{hook}</span>
      <span className="postpilot-rewrites__frozen">{rest}</span>
    </>
  )
}

export function RewriteSuggestions({ originalText, score, isPro, fingerprint, overrides, hookTypeBoosts, context, onReplace }: Props) {
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<ScoredSuggestion[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [quotaResetsAt, setQuotaResetsAt] = useState<string | null>(null)
  const [quotaRemaining, setQuotaRemaining] = useState<number | null>(null)
  const [replacedIdx, setReplacedIdx] = useState<number | null>(null)
  const [undoText, setUndoText] = useState<string | null>(null)
  const [lastMode, setLastMode] = useState<"full" | "hook">("full")

  const originalScore = score.hookScore.totalScore
  const isBorderlineOrAbove = originalScore >= 65
  const isReply = context?.kind === "reply"
  const generateLabel = isPro
    ? isBorderlineOrAbove
      ? "Rewrite anyway (3 variants)"
      : "Generate 3 rewrites"
    : isBorderlineOrAbove
      ? "Rewrite anyway"
      : "Improve this post"
  const hookLabel = isPro ? "New hook only (3 angles)" : "New hook only"

  async function handleGenerate(mode: "full" | "hook" = "full") {
    setLoading(true)
    setError(null)
    setQuotaResetsAt(null)
    setSuggestions(null)
    setUndoText(null)
    setLastMode(mode)
    try {
      const { suggestions: results, remaining } = await generateRewrites(
        originalText,
        score,
        isPro,
        context,
        hookTypeBoosts,
        mode
      )
      if (typeof remaining === "number") setQuotaRemaining(remaining)
      const scored: ScoredSuggestion[] = results.map((r) => {
        // Same context as the original score, or the delta below is
        // meaningless -- a reply scored as an original would compare against
        // the wrong length band and hook-type boosts.
        const s = scorePost(r.text, fingerprint, hookTypeBoosts, overrides, context)
        return {
          ...r,
          computedScore: s.hookScore.totalScore,
          governorIssues: s.governor.issues.map((i) => ({ severity: i.severity, matchedText: i.matchedText, message: i.message })),
        }
      })
      setSuggestions(scored)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      const resetsAt = e instanceof Error ? (e as Error & { resetsAt?: string }).resetsAt : undefined
      if (msg === "QUOTA_EXCEEDED") {
        setError("QUOTA_EXCEEDED")
        setQuotaResetsAt(resetsAt ?? null)
      } else {
        setError(msg || "Failed to generate rewrites. Try again in a moment.")
      }
    } finally {
      setLoading(false)
    }
  }

  function formatResetTime(iso: string): string {
    try {
      return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    } catch {
      return "midnight UTC"
    }
  }

  return (
    <div className="postpilot-rewrites">
      <div className="postpilot-details__heading">AI Rewrite{isPro ? " Suggestions" : " Suggestion"}</div>

      {!suggestions && !loading && (
        <>
          {isBorderlineOrAbove && (
            <div className="postpilot-rewrites__hint" style={{ fontSize: "12px", color: "#71767b", marginBottom: "6px" }}>
              Score is {originalScore}/100 — solid, but a stronger first line could push it higher.
            </div>
          )}
          <div className="postpilot-rewrites__actions">
            <button
              className="postpilot-rewrites__btn"
              onClick={() => handleGenerate("full")}>
              {generateLabel}
            </button>
            {!isReply && (
              <button
                className="postpilot-rewrites__btn postpilot-rewrites__btn--secondary"
                onClick={() => handleGenerate("hook")}>
                {hookLabel}
              </button>
            )}
          </div>
        </>
      )}

      {loading && (
        <div className="postpilot-rewrites__loading">
          {lastMode === "hook"
            ? `Generating${isPro ? " 3 hooks" : " a new hook"}...`
            : `Generating${isPro ? " 3 rewrites" : " rewrite"}...`}
        </div>
      )}

      {error === "QUOTA_EXCEEDED" ? (
        <div className="postpilot-rewrites__error">
          You've used today's included rewrites.{" "}
          {quotaResetsAt ? `Resets at ${formatResetTime(quotaResetsAt)}.` : "Resets at midnight UTC."}
          {!isPro && (
            <>
              {" "}
              <a
                href="https://postpilotpro.lemonsqueezy.com/checkout/buy/40669ef5-0219-4b06-ac42-0d9cbdf7885f?discount=0"
                target="_blank"
                rel="noreferrer"
                className="postpilot-rewrites__pro-link">
                Pro gets more rewrites/day
              </a>
              .
            </>
          )}
        </div>
      ) : error ? (
        <div className="postpilot-rewrites__error">{error}</div>
      ) : null}

      {suggestions && suggestions.length > 0 && (
        <div className="postpilot-rewrites__results">
          {suggestions.map((s, i) => {
            const delta = s.computedScore - originalScore
            const hasBlockingIssue = s.governorIssues.some((issue) => issue.severity === "error")
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
                <div className="postpilot-rewrites__text">
                  {lastMode === "hook" ? <HookPreview text={s.text} /> : s.text}
                </div>
                {s.governorIssues.length > 0 && (
                  <div className="postpilot-rewrites__gov-issues">
                    {s.governorIssues.map((issue, j) => (
                      <span
                        key={j}
                        className={`postpilot-rewrites__gov-issue postpilot-rewrites__gov-issue--${issue.severity}`}>
                        {issue.matchedText ?? issue.message}
                      </span>
                    ))}
                  </div>
                )}
                <div className="postpilot-rewrites__footer">
                  <span className="postpilot-rewrites__rationale">{s.rationale}</span>
                  <button
                    className={`postpilot-rewrites__copy postpilot-rewrites__replace${replacedIdx === i ? " postpilot-rewrites__copy--copied" : ""}`}
                    disabled={hasBlockingIssue}
                    title={hasBlockingIssue ? "Fix the flagged issue above before using this rewrite" : undefined}
                    onClick={() => {
                      setUndoText(originalText)
                      onReplace(s.text)
                      setReplacedIdx(i)
                      setTimeout(() => setReplacedIdx(null), 1500)
                    }}>
                    {replacedIdx === i ? "Done!" : hasBlockingIssue ? "Fix issue first" : "Use this"}
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
              onClick={() => handleGenerate(lastMode)}>
              Regenerate
            </button>
            {quotaRemaining != null && (
              <span className="postpilot-rewrites__pro-nudge">
                {quotaRemaining} left today
              </span>
            )}
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
