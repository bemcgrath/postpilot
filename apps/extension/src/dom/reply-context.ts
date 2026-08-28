import type { ComposerKind, ComposerSignals } from "@postpilot/core/scoring/reply-context"
import { classifyComposerSignals } from "@postpilot/core/scoring/reply-context"

export type { ComposerKind }

/**
 * LIVE-VERIFIED 2026-07-26 on an actual x.com reply modal (open question O-3
 * in the reply-learning spec, now resolved): findComposeContext's ancestor
 * walk correctly finds the textarea's container early (3 levels up from the
 * toolbar in the observed case), but "Replying to @x" and the parent tweet
 * article only render 7+ levels up -- outside that narrow container, which
 * stops climbing as soon as it finds the textarea. Widening to the enclosing
 * [role="dialog"] (confirmed present and containing both signals) fixes this
 * without loosening the scoping requirement below: .closest() still only
 * walks *this* composer's own ancestors, so it can't cross into a different
 * panel's dialog.
 */
function widenToDialog(container: HTMLElement): HTMLElement {
  return (container.closest('[role="dialog"]') as HTMLElement | null) ?? container
}

function hasReplyingToTextNear(container: HTMLElement): boolean {
  return Array.from(container.querySelectorAll("div, span")).some((el) =>
    el.textContent?.trim().startsWith("Replying to")
  )
}

/**
 * Structural analogue of collector.ts's isReplyArticle/hasOutgoingThreadConnector
 * fallback, for the inline status-page composer (not the reply modal, which
 * has no cellInnerDiv sibling at all -- see findArticleInDialog below).
 */
function hasPrecedingTweetArticle(container: HTMLElement): boolean {
  const cell = container.closest('[data-testid="cellInnerDiv"]')
  const prevArticle = cell?.previousElementSibling?.querySelector(
    'article[data-testid="tweet"]'
  )
  return prevArticle != null
}

/**
 * The reply modal renders its parent tweet directly inside the dialog, above
 * the composer -- not as a cellInnerDiv sibling, so hasPrecedingTweetArticle
 * alone misses it entirely. Confirmed live: the same dialog that contains
 * "Replying to" text also contains this article.
 */
function findArticleInDialog(container: HTMLElement): Element | null {
  return widenToDialog(container).querySelector('article[data-testid="tweet"]')
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
    hasReplyingToText: container ? hasReplyingToTextNear(widenToDialog(container)) : false,
    precededByTweetArticle: container
      ? hasPrecedingTweetArticle(container) || findArticleInDialog(container) != null
      : false,
    inDialog: container ? container.closest('[role="dialog"]') != null : false,
    pathname: typeof location !== "undefined" ? location.pathname : "",
    hasReplyToParam:
      typeof location !== "undefined" &&
      new URLSearchParams(location.search).has("in_reply_to")
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
  const article = prevArticle ?? findArticleInDialog(container)
  const textEl = article?.querySelector('[data-testid="tweetText"]')
  const text = textEl?.textContent?.trim()
  return text ? text : null
}
