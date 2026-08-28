import type { HookTypeName } from "./types"
import type { ComposerKind } from "./reply-context"

/**
 * A follow-up the user can paste after publishing. Never auto-posts.
 * Returns null for replies and short posts — those don't need a self-reply.
 */
export function suggestSelfReply(
  text: string,
  hookType: HookTypeName | null,
  kind: ComposerKind
): string | null {
  if (kind === "reply") return null
  if (text.trim().length < 40) return null

  if (hookType === "data_reveal" || hookType === "shocking_stat") {
    return "Caveat: one sample. If you've seen the opposite, I want that counter-example."
  }
  if (hookType === "contrarian" || hookType === "direct_challenge") {
    return "The claim I would most want pressure-tested: the mechanism, not the take."
  }
  if (hookType === "question" || hookType === "reader_mirror") {
    return null
  }
  return "The part I'm least sure about is the mechanism. If you've run this, what actually broke?"
}
