import type { RewriteRequestBody, RewriteSuggestion } from "./types"

// Duplicated from src/config/defaults.ts (extension) rather than shared via a
// package -- these are static string lists, low churn, and keeping the
// worker self-contained avoids coupling its deploy to the extension's build.
// If these drift apart in practice, revisit as a shared package.
const BANNED_PHRASE_LABELS = [
  "thoughts?",
  "you should",
  "game-changer",
  "revolutionary",
  "let me know",
  "what do you think",
  "drop a comment",
  "follow for more",
  "retweet",
  "rt if",
  "unlock/unlocks/unlocking",
  "leverage/leverages/leveraging",
  "delve/delving",
  "signals a bigger/major shift",
  "what this signals",
  "this signals",
  "X% confident",
  "confident this",
  "18 months",
  "12 months",
  "this accelerates",
  "I've tested",
  "tools like",
  "this year"
]

const WEAK_PHRASE_PATTERNS = [
  "this could have implications",
  "this marks a significant",
  "this illustrates a growing trend",
  "this raises questions about",
  "developers should pay attention",
  "the technology is advancing",
  "this represents an opportunity",
  "we should consider",
  "it's important to note",
  "this is significant as",
  "this could streamline",
  "this demonstrates the",
  "this highlights the",
  "this showcases",
  "warrants further exploration",
  "has the potential to",
  "could be significant",
  "may impact",
  "here's what matters",
  "the trend is clear"
]

/**
 * Stable, model-facing rules block -- identical for every caller regardless
 * of user or post content. Lives in `system` with a cache breakpoint so it's
 * a candidate for prompt caching once it's large enough to clear the
 * per-model minimum (see plan doc Part 3 -- likely not yet at this size).
 */
export function buildSystemPrompt(count: 1 | 3): string {
  return `You are helping improve an X (Twitter) post or reply. Write ${count} improved version${count > 1 ? "s" : ""} of the post you're given. Rules:
- Fix any governor violations listed in the request (remove the flagged phrases)
- Keep the same core message and roughly the same length
- Sound like a real person writing, not AI-generated
${count > 1 ? "- Each version should use a clearly different hook angle or framing" : ""}

BANNED PHRASES — never use these words or phrases, in any form:
${BANNED_PHRASE_LABELS.map((l) => `- ${l}`).join("\n")}

BANNED STYLE — no em-dashes. Do not write a word directly joined to another by "—" (e.g. "word—word"), and do not open a clause with "—it's", "—and", "—but", or "—that's". Use a period or comma instead. This is the single most common AI tell — treat it as a hard rule, not a style preference.

WEAK — avoid these generic phrases too:
${WEAK_PHRASE_PATTERNS.map((p) => `- ${p}`).join("\n")}

If a voice profile is provided in the request, calibrate word choice, sentence length, and person (first/second) toward it -- but never let it override the banned/weak phrase rules above.

Before you respond, re-read each rewrite against every rule above — banned phrases, em-dashes, weak phrases, and (if provided) the voice profile. If any rewrite still violates one, rewrite that line again until it's clean.

Respond with valid JSON only, no other text:
{
  "rewrites": [
    { "text": "...", "hookType": "one of: data_reveal|contrarian|curiosity_gap|stakes_urgency|personal_failure|question|pattern_recognition|shocking_stat|prediction|before_after|declarative_claim|direct_challenge|binary_frame", "rationale": "one sentence on why this is stronger" }
  ]
}`
}

/**
 * Per-post, per-user content -- goes in the user turn, after the cached
 * system block. This is where token spend varies request to request.
 */
export function buildUserContent(body: RewriteRequestBody): string {
  const noun = body.isReply ? "reply" : "post"
  const lines: string[] = []

  lines.push(`ORIGINAL ${noun.toUpperCase()}:`)
  lines.push(body.originalText)
  lines.push("")
  lines.push("SCORING CONTEXT:")
  lines.push(`Hook: ${body.hookInfo}`)
  lines.push(body.governorLines ? `Governor violations:\n${body.governorLines}` : "No governor violations.")
  if (body.suggestionLines) lines.push(`Hook suggestions:\n${body.suggestionLines}`)

  if (body.isReply) {
    lines.push(
      `- This is a reply: add something the parent post doesn't already say — a mechanism, a number, or a specific detail. Don't just agree or praise.` +
        (body.band ? ` Aim for roughly ${body.band.min}-${body.band.max} characters.` : "")
    )
  } else {
    lines.push(
      `- Open with a stronger hook (claim/collision/number first; builder proof second). Act on the hook suggestions above when present.`
    )
  }

  if (body.voiceDigest) {
    const d = body.voiceDigest
    lines.push("")
    lines.push("VOICE PROFILE (match this writer's style):")
    if (d.distinctiveTerms.length) lines.push(`- Signature vocabulary: ${d.distinctiveTerms.join(", ")}`)
    lines.push(`- Typical sentence length: ~${Math.round(d.sentenceLengthTarget)} words`)
    lines.push(`- First-person usage: ${(d.firstPersonRatio * 100).toFixed(0)}%, second-person: ${(d.secondPersonRatio * 100).toFixed(0)}%`)
    if (d.topHookTypes.length) lines.push(`- Preferred hook types: ${d.topHookTypes.join(", ")}`)
    if (d.signatureWords?.length) lines.push(`- Always favor these words when natural: ${d.signatureWords.join(", ")}`)
  }

  return lines.join("\n")
}

export function parseRewrites(anthropicResponseText: string): RewriteSuggestion[] {
  const jsonMatch = anthropicResponseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("PARSE_ERROR")
  const parsed = JSON.parse(jsonMatch[0]) as { rewrites?: RewriteSuggestion[] }
  return parsed.rewrites ?? []
}
