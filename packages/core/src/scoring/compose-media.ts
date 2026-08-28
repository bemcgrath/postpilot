/**
 * Split from the extension's src/dom/compose-media.ts (2026-08-28 monorepo
 * extraction): this half is the pure text-only link detection, portable to
 * any composer (mobile has no DOM to query attachments/cards from, but can
 * still detect a pasted URL in the text itself).
 */
export const URL_IN_TEXT = /https?:\/\/[^\s]+/i

export function hasLinkInText(text: string): boolean {
  return URL_IN_TEXT.test(text)
}
