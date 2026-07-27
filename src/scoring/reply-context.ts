export type ComposerKind = "original" | "reply" | "unknown"

export interface ComposerSignals {
  hasReplyingToText: boolean // "Replying to @x" near the composer
  precededByTweetArticle: boolean // a rendered parent tweet above the composer
  inDialog: boolean // composer is inside [role="dialog"]
  pathname: string // location.pathname
}

/**
 * Classify a composer from already-gathered signals (pure, unit-testable).
 * "unknown" is a real, distinct outcome -- callers must treat it as
 * "original" for scoring purposes (today's behavior), so an ambiguous
 * surface never regresses into being mis-scored as a reply.
 */
export function classifyComposerSignals(signals: ComposerSignals): ComposerKind {
  if (signals.hasReplyingToText) return "reply"

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

function hasReplyingToTextNear(container: HTMLElement): boolean {
  return Array.from(container.querySelectorAll("div, span")).some((el) =>
    el.textContent?.trim().startsWith("Replying to")
  )
}

/**
 * Structural analogue of collector.ts's isReplyArticle/hasOutgoingThreadConnector
 * fallback, for the composer surface rather than a rendered timeline tweet.
 * NOT LIVE-VERIFIED (open question O-3 in the reply-learning spec): confirm on
 * x.com, in both the reply modal and the status-page inline composer, whether
 * a parent tweet article actually renders immediately before the composer's
 * scoped container before relying on this signal.
 */
function hasPrecedingTweetArticle(container: HTMLElement): boolean {
  const cell = container.closest('[data-testid="cellInnerDiv"]')
  const prevArticle = cell?.previousElementSibling?.querySelector(
    'article[data-testid="tweet"]'
  )
  return prevArticle != null
}

/**
 * Read composer signals from a scoped DOM container and classify it.
 * `container` must already be scoped to this specific composer (the same
 * ancestor walk PostPilotPanel's findNearestComposeBox uses) -- never pass a
 * bare document-wide query, or a background panel could mirror a reply
 * modal's "reply" classification the way it once mirrored the modal's text.
 */
export function detectComposerKind(container: HTMLElement | null): ComposerKind {
  const signals: ComposerSignals = {
    hasReplyingToText: container ? hasReplyingToTextNear(container) : false,
    precededByTweetArticle: container ? hasPrecedingTweetArticle(container) : false,
    inDialog: container ? container.closest('[role="dialog"]') != null : false,
    pathname: typeof location !== "undefined" ? location.pathname : ""
  }
  return classifyComposerSignals(signals)
}

/** Read the parent tweet's text for adds-vs-echoes scoring. Same scoping requirement as detectComposerKind. */
export function readParentTweetText(container: HTMLElement | null): string | null {
  if (!container) return null
  const cell = container.closest('[data-testid="cellInnerDiv"]')
  const prevArticle = cell?.previousElementSibling?.querySelector(
    'article[data-testid="tweet"]'
  )
  const textEl = prevArticle?.querySelector('[data-testid="tweetText"]')
  const text = textEl?.textContent?.trim()
  return text ? text : null
}
