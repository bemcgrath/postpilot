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
      max_tokens: 2048,
      // Sonnet 5 turns adaptive thinking on when `thinking` is omitted
      // (Sonnet 4.6 did the opposite). Thinking tokens count toward
      // max_tokens, so a long rules prompt + medium effort often spent
      // the whole budget on a thinking block and returned no JSON
      // (EMPTY_RESPONSE / 502). This task is a 280-char rewrite: turn
      // thinking off and just write the JSON.
      thinking: { type: "disabled" },
      output_config: { effort: "medium" },
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
    stop_reason?: string
    usage?: {
      input_tokens: number
      output_tokens: number
      cache_creation_input_tokens?: number
      cache_read_input_tokens?: number
    }
  }
  if (data.usage) {
    console.log(
      "[postpilot-rewrite-worker] usage",
      JSON.stringify({ ...data.usage, stop_reason: data.stop_reason })
    )
  }
  const textBlock = data.content?.find(
    (c) => (c.type === "text" || c.type === "output_text") && c.text
  )?.text
  if (!textBlock) {
    const types = (data.content ?? []).map((c) => c.type)
    console.error("[postpilot-rewrite-worker] empty text", data.stop_reason, types)
    throw new Error("EMPTY_RESPONSE")
  }
  return textBlock
}
