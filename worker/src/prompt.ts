import type { RewriteRequestBody, RewriteSuggestion } from "./types"

// Duplicated from src/config/defaults.ts (extension) rather than shared via a
// package -- these are static string lists, low churn, and keeping the
// worker self-contained avoids coupling its deploy to the extension's build.
// If these drift apart in practice, revisit as a shared package.
const BANNED_PHRASE_LABELS = [
  "thoughts?",
  "you should",
  "let me know",
  "what do you think",
  "drop a comment",
  "follow for more",
  "retweet",
  "rt if",
  "X% confident",
  "confident this",
  "18 months",
  "12 months",
  "I've tested",
  "this year"
]

const AI_SLOP_LABELS = [
  "game-changer",
  "revolutionary",
  "unlock/unlocks/unlocking",
  "leverage/leverages/leveraging",
  "delve/delving",
  "signals a bigger/major shift",
  "what this signals",
  "this signals",
  "this accelerates",
  "tools like",
  "tapestry",
  "in today's rapidly/fast-paced",
  "as an AI"
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
  return `You are rewriting an X (Twitter) ${count > 1 ? "post into " + count + " more engaging versions" : "post to be more engaging"}. Engagement means: someone stops scrolling, replies, or reposts. The numeric score is a proxy for that, not the goal.

Steer toward patterns that earn engagement:
- Put the interesting part first (a sharp claim, a collision with conventional wisdom, a named mechanism, a number the writer already used)
- When the request lists hook types that outperform for this writer, prefer those
- Be specific. Vague takes die in the feed
- For replies: add a mechanism, a constraint, or a detail the parent didn't say. Don't agree or praise

Prevent patterns that kill engagement:
- AI slop, engagement bait ("thoughts?", "what do you think", "drop a comment"), weak filler
- Em-dashes (the most common AI tell; readers bounce)
- Invented personal studies ("I tracked N for D days", "I tested N", "here's what I found", "my data show") when the original has no such evidence. Fake specificity is bait, not a hook. If they already have numbers, use those. If they don't, make a truer sharper claim. Don't fabricate a dataset.

Keep the same core message. Sound like a person, not a model.
For original posts (not replies): line 1 is a complete hook — a full claim with the interesting part already in it (specifics, a mechanism, or a collision with conventional wisdom). Then break the rest the way this writer usually does (short lines / stanzas). Do not open with a fragment. Do not flatten the whole post into one paragraph. Put real newlines in the JSON "text" field.
For replies: do not impose post stanza layout. Write a tight conversational reply. Match vocabulary and person if a voice profile is provided.
${count > 1 ? "Each version should use a clearly different hook angle." : ""}

BANNED PHRASES — never use these words or phrases, in any form:
${BANNED_PHRASE_LABELS.map((l) => `- ${l}`).join("\n")}

AI SLOP — never use these ChatGPT tells:
${AI_SLOP_LABELS.map((l) => `- ${l}`).join("\n")}

BANNED STYLE — no em-dashes. Do not write a word directly joined to another by "—" (e.g. "word—word"), and do not open a clause with "—it's", "—and", "—but", or "—that's". Use a period or comma instead.

WEAK — avoid these generic phrases too:
${WEAK_PHRASE_PATTERNS.map((p) => `- ${p}`).join("\n")}

If a voice profile is provided, match that writer's vocabulary and person (first/second). For original posts, also match layout (line breaks, fragments, colons/lists) after a complete first-line hook.

Apply the banned-phrase, em-dash, slop, and invented-study rules in one pass. Output JSON only, no drafts or commentary:
{
  "rewrites": [
    { "text": "...", "hookType": "one of: data_reveal|contrarian|curiosity_gap|stakes_urgency|personal_failure|question|pattern_recognition|shocking_stat|prediction|before_after|declarative_claim|direct_challenge|binary_frame", "rationale": "one sentence on why this is more engaging" }
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
  const originalBreaks = (body.originalText.match(/\n/g) ?? []).length
  if (!body.isReply && originalBreaks >= 2) {
    lines.push(
      `FORMAT: this draft uses ${originalBreaks} line breaks. After a complete hook on line 1, keep a similar short-line / stanza layout. Do not flatten into one paragraph.`
    )
  }
  lines.push("")
  lines.push("SCORING CONTEXT:")
  lines.push(`Hook: ${body.hookInfo}`)
  lines.push(body.governorLines ? `Governor violations:\n${body.governorLines}` : "No governor violations.")
  if (body.suggestionLines) lines.push(`Hook suggestions:\n${body.suggestionLines}`)

  lines.push("")
  lines.push("GOAL: a more engaging version of this " + noun + ". Fix any governor violations.")
  if (body.engagementLines) {
    lines.push("WHAT EARNS ENGAGEMENT FOR THIS WRITER:")
    lines.push(body.engagementLines)
  }

  if (body.isReply) {
    lines.push(
      `- This is a reply: add something the parent post doesn't already say (a mechanism, a number, or a specific detail). Don't just agree or praise. Do not rewrite it as a stanza original.` +
        (body.band ? ` Aim for roughly ${body.band.min}-${body.band.max} characters.` : "")
    )
  } else {
    lines.push(
      `- Line 1 is the hook: a complete claim that would stop a scroll, not a fragment. Then break the rest as this writer usually does. Prefer high-engagement hook types above when they fit. Don't invent a tracking study or sample size. If the original has no data, sharpen the claim they already made.`
    )
    if (body.band) {
      lines.push(`- Aim for roughly ${body.band.min}-${body.band.max} characters (length that has worked for this writer).`)
    }
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
    if (!body.isReply) {
      if (typeof d.fragmentRatio === "number") {
        lines.push(`- Short fragments (≤5 words): ${Math.round(d.fragmentRatio * 100)}% of sentences — after line 1`)
      }
      if (typeof d.lineBreaksPerPost === "number") {
        lines.push(
          `- Typical line breaks per post: ~${Math.round(d.lineBreaksPerPost)}. After a complete first-line hook, match this layout even if this draft is a single block.`
        )
      }
      if (typeof d.usesColons === "number") {
        lines.push(`- Colons: ${d.usesColons >= 0.3 ? "often" : "rarely"}`)
      }
      if (typeof d.usesLists === "number") {
        lines.push(`- Lists: ${d.usesLists >= 0.3 ? "often" : "rarely"}`)
      }
    }
  }

  return lines.join("\n")
}

export function parseRewrites(anthropicResponseText: string): RewriteSuggestion[] {
  const jsonMatch = anthropicResponseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("PARSE_ERROR")
  try {
    const parsed = JSON.parse(jsonMatch[0]) as { rewrites?: RewriteSuggestion[] }
    return parsed.rewrites ?? []
  } catch {
    throw new Error("PARSE_ERROR")
  }
}
