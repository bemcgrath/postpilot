import type { Env } from "./types"

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"

/**
 * Calls the Anthropic Messages API with PostPilot's own key. `system` carries
 * the stable, cacheable rules block (see prompt.ts); `userContent` carries
 * the per-post, per-user content. Returns the raw text of the first text
 * block -- callers parse the rewrites JSON out of it (prompt.ts#parseRewrites).
 */
export async function callAnthropic(env: Env, system: string, userContent: string): Promise<string> {
  const response = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: env.MODEL_ID,
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: system,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userContent }],
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    console.error("[postpilot-rewrite-worker] Anthropic error", response.status, body)
    throw new Error(`ANTHROPIC_ERROR:${response.status}`)
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>
  }
  const textBlock = data.content?.find((c) => c.type === "text")?.text
  if (!textBlock) throw new Error("EMPTY_RESPONSE")
  return textBlock
}
