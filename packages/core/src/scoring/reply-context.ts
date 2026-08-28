/**
 * Split from the extension's src/dom/reply-context.ts (2026-08-28 monorepo
 * extraction): this half is the pure classification logic. The DOM signal
 * gathering (detectComposerKind, readParentTweetText) stays extension-side
 * -- there's no x.com DOM to read on mobile, where ComposerKind instead
 * comes from an explicit "replying to" field the user fills in themselves.
 */
export type ComposerKind = "original" | "reply" | "unknown"

export interface ComposerSignals {
  hasReplyingToText: boolean // "Replying to @x" near the composer
  precededByTweetArticle: boolean // a rendered parent tweet above the composer
  inDialog: boolean // composer is inside [role="dialog"]
  pathname: string // location.pathname
  hasReplyToParam: boolean // in_reply_to= present in location.search (X's own /intent/post reply URLs)
}

/**
 * Classify a composer from already-gathered signals (pure, unit-testable).
 * "unknown" is a real, distinct outcome -- callers must treat it as
 * "original" for scoring purposes (today's behavior), so an ambiguous
 * surface never regresses into being mis-scored as a reply.
 */
export function classifyComposerSignals(signals: ComposerSignals): ComposerKind {
  if (signals.hasReplyingToText) return "reply"

  // A URL-level signal, not DOM-dependent -- caught a real bug where a
  // /intent/post?in_reply_to=... reply landed on neither of the two
  // pathname patterns below and had to fall back entirely on DOM text.
  if (signals.hasReplyToParam) return "reply"

  if (
    signals.pathname === "/compose/post" ||
    /^\/(home|explore|notifications)\/?$/.test(signals.pathname)
  ) {
    return "original"
  }

  if (signals.precededByTweetArticle) return "reply"

  if (/^\/[^/]+\/status\/\d+/.test(signals.pathname)) return "reply"

  return "unknown"
}
