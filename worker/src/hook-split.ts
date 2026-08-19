/**
 * Split an original into the hook we replace and the frozen remainder.
 * First newline wins. Otherwise first sentence, else the first 120 chars —
 * same ceiling as the extension's hookMaxLength default.
 *
 * Duplicated in src/rewrite/hook-split.ts so the worker stays self-contained.
 */
export const HOOK_MAX_LENGTH = 120

export function splitHookBody(text: string): { hook: string; rest: string } {
  const newline = text.indexOf("\n")
  if (newline !== -1) {
    return {
      hook: text.slice(0, newline).replace(/\r$/, ""),
      rest: text.slice(newline),
    }
  }

  if (text.length <= HOOK_MAX_LENGTH) {
    return { hook: text, rest: "" }
  }

  const sentence = text.match(/^[^.!?]*[.!?]/)
  if (sentence && sentence[0].length <= HOOK_MAX_LENGTH) {
    return { hook: sentence[0], rest: text.slice(sentence[0].length) }
  }

  return { hook: text.slice(0, HOOK_MAX_LENGTH), rest: text.slice(HOOK_MAX_LENGTH) }
}

/** First line of model output, flattened so a hook cannot smuggle a new body. */
export function firstLineOf(text: string): string {
  const newline = text.indexOf("\n")
  const line = (newline === -1 ? text : text.slice(0, newline)).replace(/\r$/, "")
  return line.replace(/\s+/g, " ").trim()
}

export function stitchHook(newHook: string, rest: string): string {
  const line = firstLineOf(newHook)
  if (!rest) return line
  return line + rest
}
