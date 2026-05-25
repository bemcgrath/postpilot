import type { PostScore } from "~scoring/types"
import { humanizeHookType } from "~scoring/hook-types"
import { getClaudeApiKey } from "./api-key-storage"

export interface RewriteSuggestion {
  text: string
  hookType?: string
  rationale: string
}

export async function generateRewrites(
  originalText: string,
  score: PostScore,
  isPro: boolean
): Promise<RewriteSuggestion[]> {
  const apiKey = await getClaudeApiKey()
  if (!apiKey) throw new Error("NO_API_KEY")

  const count = isPro ? 3 : 1

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

  const prompt = `You are helping improve an X (Twitter) post that scored below 65/100.

ORIGINAL POST:
${originalText}

SCORING CONTEXT:
Hook: ${hookInfo}
${governorLines ? `Governor violations:\n${governorLines}` : "No governor violations."}
${suggestionLines ? `Hook suggestions:\n${suggestionLines}` : ""}

Write ${count} improved version${count > 1 ? "s" : ""} of this post. Rules:
- Fix any governor violations (remove the flagged phrases)
- Open with a stronger hook
- Keep the same core message and roughly the same length
- Sound like a real person writing, not AI-generated
- No hype words ("game-changer", "leverage", "delve", "exciting")
${count > 1 ? "- Each version should use a clearly different hook angle or framing" : ""}

Respond with valid JSON only, no other text:
{
  "rewrites": [
    { "text": "...", "hookType": "one of: data_reveal|contrarian|curiosity_gap|stakes_urgency|personal_failure|question|pattern_recognition|shocking_stat|prediction|before_after|declarative_claim|direct_challenge|binary_frame", "rationale": "one sentence on why this is stronger" }
  ]
}`

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  })

  if (!response.ok) {
    if (response.status === 401) throw new Error("INVALID_API_KEY")
    throw new Error(`API_ERROR:${response.status}`)
  }

  const data = await response.json() as { content: Array<{ type: string; text: string }> }
  const content = data.content.find((c) => c.type === "text")?.text ?? ""

  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("PARSE_ERROR")

  const parsed = JSON.parse(jsonMatch[0]) as { rewrites?: RewriteSuggestion[] }
  return parsed.rewrites ?? []
}
