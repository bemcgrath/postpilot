import type { PostScore } from "~scoring/types"
import type { ScoreContext } from "~scoring/scoring-pipeline"
import { humanizeHookType } from "~scoring/hook-types"
import { getClaudeApiKey } from "./api-key-storage"
import { BANNED_PHRASE_LABELS, WEAK_PHRASE_PATTERNS } from "~config/defaults"

export interface RewriteSuggestion {
  text: string
  hookType?: string
  rationale: string
}

function buildPrompt(
  originalText: string,
  score: PostScore,
  count: number,
  context?: ScoreContext
): string {
  const isReply = context?.kind === "reply"
  const noun = isReply ? "reply" : "post"

  const governorLines = score.governor.issues
    .filter((i) => i.severity === "error" || i.severity === "warning")
    .map((i) => `- ${i.message} (matched: "${i.matchedText}")`)
    .join("\n")

  const hookInfo = score.hookScore.hookType
    ? `${humanizeHookType(score.hookScore.hookType)} hook — score ${score.hookScore.totalScore}/100`
    : `No recognized hook — score ${score.hookScore.totalScore}/100`

  const suggestionLines = score.hookScore.suggestions?.length
    ? score.hookScore.suggestions.map((s) => `- ${s}`).join("\n")
    : ""

  const band = context?.replyInsights?.optimalLengthRange
  const openingRule = isReply
    ? `- Add something the parent post doesn't already say — a mechanism, a number, or a specific detail. Don't just agree or praise.${band ? ` Aim for roughly ${band.min}-${band.max} characters.` : ""}`
    : `- Open with a stronger hook (claim/collision/number first; builder proof second). Act on the hook suggestions listed above when present`

  // Em-dash rules read as cryptic labels ("em-dash (—it's)") when flattened into
  // the same bulleted list as literal phrases like "game-changer" -- easy for the
  // model to skim past, and em-dashes are the single most common AI tell it
  // reaches for by default. Pulled into their own plain-language rule instead.
  const literalBannedLabels = BANNED_PHRASE_LABELS.filter((l) => !l.startsWith("em-dash"))

  return `You are helping improve an X (Twitter) ${noun} (current ${isReply ? "" : "hook "}score ${score.hookScore.totalScore}/100).

ORIGINAL ${noun.toUpperCase()}:
${originalText}

SCORING CONTEXT:
Hook: ${hookInfo}
${governorLines ? `Governor violations:\n${governorLines}` : "No governor violations."}
${suggestionLines ? `Hook suggestions:\n${suggestionLines}` : ""}

Write ${count} improved version${count > 1 ? "s" : ""} of this ${noun}. Rules:
- Fix any governor violations listed above (remove the flagged phrases)
${openingRule}
- Keep the same core message and roughly the same length
- Sound like a real person writing, not AI-generated
${count > 1 ? "- Each version should use a clearly different hook angle or framing" : ""}

BANNED PHRASES — never use these words or phrases, in any form:
${literalBannedLabels.map((l) => `- ${l}`).join("\n")}

BANNED STYLE — no em-dashes. Do not write a word directly joined to another by "—" (e.g. "word—word"), and do not open a clause with "—it's", "—and", "—but", or "—that's". Use a period or comma instead. This is the single most common AI tell — treat it as a hard rule, not a style preference.

WEAK — avoid these generic phrases too:
${WEAK_PHRASE_PATTERNS.slice(0, 20).map((p) => `- ${p}`).join("\n")}

Before you respond, re-read each rewrite against every rule above — banned phrases, em-dashes, and weak phrases. If any rewrite still violates one, rewrite that line again until it's clean.

Respond with valid JSON only, no other text:
{
  "rewrites": [
    { "text": "...", "hookType": "one of: data_reveal|contrarian|curiosity_gap|stakes_urgency|personal_failure|question|pattern_recognition|shocking_stat|prediction|before_after|declarative_claim|direct_challenge|binary_frame", "rationale": "one sentence on why this is stronger" }
  ]
}`
}

function parseRewrites(data: unknown): RewriteSuggestion[] {
  const d = data as { content?: Array<{ type: string; text: string }> }
  const content = d.content?.find((c) => c.type === "text")?.text ?? ""
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("PARSE_ERROR")
  const parsed = JSON.parse(jsonMatch[0]) as { rewrites?: RewriteSuggestion[] }
  return parsed.rewrites ?? []
}

export async function generateRewrites(
  originalText: string,
  score: PostScore,
  isPro: boolean,
  context?: ScoreContext
): Promise<RewriteSuggestion[]> {
  const apiKey = await getClaudeApiKey()
  if (!apiKey) throw new Error("NO_API_KEY")

  const prompt = buildPrompt(originalText, score, isPro ? 3 : 1, context)

  // Route through background service worker to avoid CORS restrictions
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "GENERATE_REWRITES", apiKey, prompt },
      (response: { ok: boolean; data?: unknown; error?: string }) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        if (!response.ok) {
          reject(new Error(response.error ?? "API_ERROR"))
          return
        }
        try {
          resolve(parseRewrites(response.data))
        } catch (e) {
          reject(e)
        }
      }
    )
  })
}
