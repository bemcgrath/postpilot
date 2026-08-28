/**
 * Duplicated from worker/src/hook-split.ts — worker deploy must not depend
 * on the extension package. Keep the split rule in lockstep.
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
