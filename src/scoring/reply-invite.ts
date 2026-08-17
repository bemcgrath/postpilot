/**
 * Conversation vs broadcast for original posts.
 * Rewards a specific question. Does not reward "thoughts?" bait
 * (those are already governor errors).
 */

const BAIT = [
  /\bthoughts\s*\?/i,
  /\bwhat do you think\b/i,
  /\bagree\s*\?/i,
  /\bdrop a comment\b/i,
  /\blet me know\b/i,
  /\brt if\b/i,
  /\bfollow for more\b/i
]

const HAS_QUESTION = /\?/

const SPECIFICITY = /(?:\d|[A-Z][a-z]{2,}\s[A-Z]|@\w+|https?:\/\/)/

export type ReplyInviteKind = "invite" | "bait" | "broadcast"

export interface ReplyInvite {
  kind: ReplyInviteKind
  label: string
}

export function scoreReplyInvite(text: string): ReplyInvite {
  const trimmed = text.trim()
  if (BAIT.some((re) => re.test(trimmed))) {
    return { kind: "bait", label: "Reply bait" }
  }
  if (HAS_QUESTION.test(trimmed) && SPECIFICITY.test(trimmed)) {
    return { kind: "invite", label: "Invites a reply" }
  }
  if (/\?\s*$/.test(trimmed) && trimmed.length > 40) {
    return { kind: "invite", label: "Invites a reply" }
  }
  return { kind: "broadcast", label: "Broadcast" }
}
