import type { ComposeMedia } from "@postpilot/core/scoring/types"
import { EMPTY_MEDIA } from "@postpilot/core/scoring/media-delta"
import { hasLinkInText } from "@postpilot/core/scoring/compose-media"

/** Selectors used in compose and published-tweet DOM. Kept here so fixture tests break when X renames them. */
export const COMPOSE_SELECTORS = {
  toolbar: '[data-testid="toolBar"]',
  textarea: '[data-testid="tweetTextarea_0"]',
  contentEditable: '[data-testid="tweetTextarea_0"] [contenteditable="true"]',
  attachments: '[data-testid="attachments"]',
  tweetButton: '[data-testid="tweetButton"]',
  tweetButtonInline: '[data-testid="tweetButtonInline"]'
} as const

export const TWEET_SELECTORS = {
  article: 'article[data-testid="tweet"]',
  userName: '[data-testid="User-Name"]',
  tweetText: '[data-testid="tweetText"]',
  analytics: 'a[href*="/analytics"]',
  time: "time",
  like: '[data-testid="like"]',
  retweet: '[data-testid="retweet"]',
  reply: '[data-testid="reply"]',
  tweetPhoto: '[data-testid="tweetPhoto"]',
  card: '[data-testid="card.wrapper"]'
} as const

/**
 * Attachments that belong to THIS composer, not a published tweet in the
 * same ancestor (reply modal / inline reply sit next to the parent article).
 */
function composerAttachments(container: Element): Element | null {
  const nodes = container.querySelectorAll(COMPOSE_SELECTORS.attachments)
  for (const el of nodes) {
    if (!el.closest(TWEET_SELECTORS.article)) return el
  }
  return null
}

function composerCard(container: Element): Element | null {
  const nodes = container.querySelectorAll(TWEET_SELECTORS.card)
  for (const el of nodes) {
    if (!el.closest(TWEET_SELECTORS.article)) return el
  }
  return null
}

/**
 * Detect image/video attachments and links in the compose container.
 * `container` is the ancestor that holds both the textarea and the toolbar.
 * Parent-tweet photos, avatars, and timeline videos must not count.
 */
export function detectComposeMedia(
  container: Element | null,
  text: string
): ComposeMedia {
  const hasLinkInTextResult = hasLinkInText(text)
  if (!container) {
    return { ...EMPTY_MEDIA, hasLink: hasLinkInTextResult }
  }

  const attachments = composerAttachments(container)
  const hasImage =
    attachments?.querySelector(TWEET_SELECTORS.tweetPhoto) != null
  const hasVideo =
    attachments?.querySelector("video, [data-testid='gifPlayer']") != null
  const hasLink = hasLinkInTextResult || composerCard(container) != null

  return { hasImage, hasVideo, hasLink }
}
